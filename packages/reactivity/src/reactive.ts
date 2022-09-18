import { isObject, toRawType, def } from '@vue/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers,
  shallowReadonlyCollectionHandlers
} from './collectionHandlers'
import type { UnwrapRefSimple, Ref, RawSymbol } from './ref'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()
export const shallowReactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()
export const shallowReadonlyMap = new WeakMap<Target, any>()

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

/**
 * 获取对象 target 的类型
 * @param value
 * @returns 无效 ｜ COMMON ｜ COLLECTION
 */
function getTargetType(value: Target) {
  // __v_skip 表示不可被代理，需要跳过
  // !Object.isExtensible(value) 对象不可被扩展
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

// only unwrap nested ref
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

/**
 * Creates a reactive copy of the original object.
 *
 * The reactive conversion is "deep"—it affects all nested properties. In the
 * ES2015 Proxy based implementation, the returned proxy is **not** equal to the
 * original object. It is recommended to work exclusively with the reactive
 * proxy and avoid relying on the original object.
 *
 * A reactive object also automatically unwraps refs contained in it, so you
 * don't need to use `.value` when accessing and mutating their value:
 *
 * ```js
 * const count = ref(0)
 * const obj = reactive({
 *   count
 * })
 *
 * obj.count++
 * obj.count // -> 1
 * count.value // -> 1
 * ```
 */
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  /**
   *  FIXME: reactive 接受一个 readonly 代理对象时，直接返回
      const proxy1 = readonly({});
      const proxy2 = reactive(proxy1);
      console.log("验证一：", proxy1 === proxy2); // true
   */
  // if trying to observe a readonly proxy, return the readonly version.
  if (isReadonly(target)) {
    return target
  }
  return createReactiveObject(
    target, // arr、obj、map、set 这几种类型
    false,
    mutableHandlers, // arr、obj 适用于这个
    mutableCollectionHandlers, // map、set 适用于这个
    reactiveMap
  )
}

export declare const ShallowReactiveMarker: unique symbol

export type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }

/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
export function shallowReactive<T extends object>(
  target: T
): ShallowReactive<T> {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  )
}

type Primitive = string | number | boolean | bigint | symbol | undefined | null
type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends ReadonlySet<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepReadonly<U>>
  : T extends Promise<infer U>
  ? Promise<DeepReadonly<U>>
  : T extends Ref<infer U>
  ? Readonly<Ref<DeepReadonly<U>>>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : Readonly<T>

/**
 * Creates a readonly copy of the original object. Note the returned copy is not
 * made reactive, but `readonly` can be called on an already reactive object.
 */
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  )
}

/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  )
}

function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  // 只接受对象类型
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }

  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  // 一个对象被代理过后，就会加上 __v_raw 属性
  /**
   *  FIXME: readonly 可以接受一个 reactive 代理过的对象
      const proxy3 = reactive({});
      const proxy4 = readonly(proxy3);
      console.log("验证：", proxy4 === proxy3, proxy4, proxy3); // false
   */

  /**
   *  FIXME: reactive 可以接受一个 reactive 代理过的对象，但是并不会再次做响应式代理，而是直接返回上一次代理后的响应式对象
      const proxy5 = reactive({});
      const proxy6 = reactive(proxy5);
      console.log("验证：", proxy5 === proxy6); // true
   */
  if (
    target[ReactiveFlags.RAW] &&
    (!isReadonly || !target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }

  /**
   *  FIXME: reactive 处理同一个对象，返回的仍旧是上次的代理后结果对象，原因是因为有缓存记录
      const obj1 = {};
      const proxy7 = reactive(obj1);
      const proxy8 = reactive(obj1);
      console.log("验证：", proxy7 === proxy8); // true
   */
  // 代理过后会有缓存记录，如果代理已经存在了，就直接返回
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 判断这个对象能否被代理
  // only specific value types can be observed.
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    // 不能代理
    return target
  }

  // 开始代理
  const proxy = new Proxy(
    target,
    // 代理使用的 handler
    // 公共 COMMON 类型使用 baseHandlers（object、array）
    // 集合类型的 使用 collectionHandlers（set、map）
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )

  // 设置缓存
  proxyMap.set(target, proxy)
  // 最后 reactive 返回代理结果
  return proxy
}

export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW])
}

export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

/**
 * 处理一个响应式代理对象，返回其未被代理前的对象 target
 * @param observed
 * @returns
 */
export function toRaw<T>(observed: T): T {
  // (observed as Target)[ReactiveFlags.RAW] 拿到的是这个代理对象原本的 target 对象，当然也可能是没有
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  // 为什么还要进行 toRaw 呢？
  // 主要用来处理 ：readonly(reactive({}))
  return raw ? toRaw(raw) : observed
}

/**
 * 标记一个对象，使得该对象不能被代理
 * @param value
 * @returns
 */
export function markRaw<T extends object>(
  value: T
): T & { [RawSymbol]?: true } {
  // 给这个对象添加 __v_skip 属性，就可以跳过代理
  def(value, ReactiveFlags.SKIP, true)
  return value
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value

export const toReadonly = <T extends unknown>(value: T): T =>
  isObject(value) ? readonly(value as Record<any, any>) : value
