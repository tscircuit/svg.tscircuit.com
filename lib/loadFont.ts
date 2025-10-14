import { registerFont } from "canvas"
import { join } from "path"

let fontLoaded = false

export function loadFont() {
  if (fontLoaded) return
  registerFont(
    join(process.cwd(), "public", "fonts", "RobotoMono-Regular.ttf"),
    {
      family: "Roboto Mono",
    },
  )
  registerFont(
    join(process.cwd(), "public", "fonts", "RobotoMono-Regular.ttf"),
    {
      family: "sans-serif",
    },
  )
  fontLoaded = true
}
