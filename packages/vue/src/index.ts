// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { initDev } from './dev'
import { compile, CompilerOptions, CompilerError } from '@vue/compiler-dom'
import { registerRuntimeCompiler, RenderFunction, warn } from '@vue/runtime-dom'
import * as runtimeDom from '@vue/runtime-dom'
import { isString, NOOP, generateCodeFrame, extend } from '@vue/shared'
import { InternalRenderFunction } from 'packages/runtime-core/src/component'

if (__DEV__) {
  initDev()
}

// 编译缓存
const compileCache: Record<string, RenderFunction> = Object.create(null)

/**
 * 将模版编译 转换出 渲染函数
 * @param template 
 * @param options 
 * @returns 
 */
function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions
): RenderFunction {

  // template 为 非 string
  if (!isString(template)) {
    if (template.nodeType) {
      // template 为 Node 节点
      template = template.innerHTML
    } else {
      // 异常情况
      __DEV__ && warn(`invalid template option: `, template)
      return NOOP
    }
  }

  // 缓存的处理，先跳过
  const key = template
  const cached = compileCache[key]
  if (cached) {
    return cached
  }

  // template 为 #开头的 ID
  if (template[0] === '#') {
    // 找到元素 DOM
    const el = document.querySelector(template)
    if (__DEV__ && !el) {
      warn(`Template element not found or is empty: ${template}`)
    }
    // __UNSAFE__
    // Reason: potential execution of JS expressions in in-DOM template.
    // The user must make sure the in-DOM template is trusted. If it's rendered
    // by the server, the template should not contain any user data.
    // 元素 DOM 的 innerHTML
    template = el ? el.innerHTML : ``
  }

  // 最后到这里， template 本质是一个字符串，模版字符串

  // 模版编译
  // 生成 render 函数的代码
  const { code } = compile(
    template,
    extend(
      {
        hoistStatic: true,
        onError: __DEV__ ? onError : undefined,
        onWarn: __DEV__ ? e => onError(e, true) : NOOP
      } as CompilerOptions,
      options
    )
  )

  function onError(err: CompilerError, asWarning = false) {
    const message = asWarning
      ? err.message
      : `Template compilation error: ${err.message}`
    const codeFrame =
      err.loc &&
      generateCodeFrame(
        template as string,
        err.loc.start.offset,
        err.loc.end.offset
      )
    warn(codeFrame ? `${message}\n${codeFrame}` : message)
  }

  // The wildcard import results in a huge object with every export
  // with keys that cannot be mangled, and can be quite heavy size-wise.
  // In the global build we know `Vue` is available globally so we can avoid
  // the wildcard object.
  // 真正的 render 函数，通过 new Function 而来的
  const render = (
    __GLOBAL__ ? new Function(code)() : new Function('Vue', code)(runtimeDom)
  ) as RenderFunction

  // mark the function as runtime compiled
  ;(render as InternalRenderFunction)._rc = true

  // 缓存记录，最终返回 render 函数
  return (compileCache[key] = render)
}

// 完成注册，该函数的执行时机待定
registerRuntimeCompiler(compileToFunction)

// 最终导出
export { compileToFunction as compile }
// createApp 也是从这里导出的
export * from '@vue/runtime-dom'
