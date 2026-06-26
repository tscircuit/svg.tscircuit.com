const COMPILATION_ERROR_PATTERNS = [
  /Eval compiled js error/i,
  /Unexpected token/i,
  /Cannot find module/i,
  /Unresolved import/i,
  /Node module imported but not in package\.json/i,
  /Entrypoint ".+" not found/i,
  /Either entrypoint or mainComponentPath must be provided/i,
  /Main component path ".+" not found/i,
  /Failed to parse tsconfig\.json/i,
  /has no files in dist, it may not be built/i,
  /main path \(.+\) was not found, it may not be built/i,
]

export type NormalizedError = {
  title: string
  message: string
  status: number
}

const stringifyError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string") return error

  if (error && typeof error === "object") {
    const message = Reflect.get(error, "message")
    if (typeof message === "string" && message.length > 0) {
      return message
    }

    try {
      return JSON.stringify(error, null, 2)
    } catch {
      return String(error)
    }
  }

  return "Unknown error"
}

const isCompilationError = (message: string): boolean =>
  COMPILATION_ERROR_PATTERNS.some((pattern) => pattern.test(message))

export const normalizeError = (error: unknown): NormalizedError => {
  const message = stringifyError(error)

  if (isCompilationError(message)) {
    return {
      title: "Compilation Error",
      message,
      status: 400,
    }
  }

  return {
    title: "Rendering Error",
    message,
    status: 500,
  }
}
