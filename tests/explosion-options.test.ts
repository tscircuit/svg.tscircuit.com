import { expect, test } from "bun:test"
import { getRequestContext } from "../lib/getRequestContext"
import { handleRequest } from "../shared/handle-request"

test("explosion parameters validate progress and let POST override query values", async () => {
  const ctx = await getRequestContext(
    new Request(
      "http://localhost/?explosion_stage=first&explosion_progress=0.2",
      {
        method: "POST",
        body: JSON.stringify({
          explosion_stage: "case.last",
          explosion_progress: 0.75,
        }),
      },
    ),
  )
  if (ctx instanceof Response) throw new Error("Expected request context")
  expect(ctx.explosion).toEqual({
    throughStageRef: "case.last",
    stageProgress: 0.75,
  })
  for (const progress of [
    "",
    "NaN",
    "Infinity",
    "-0.1",
    "1.1",
    null,
    true,
    {},
  ]) {
    const result = await getRequestContext(
      new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ explosion_progress: progress }),
      }),
    )
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(400)
  }
  for (const query of [
    "explosion_stage=",
    "explosion_progress=oops",
    "explosion_stage=missing",
  ]) {
    const result = await handleRequest(
      new Request(`http://localhost/?format=glb&${query}`, {
        method: "POST",
        body: JSON.stringify({ circuit_json: [] }),
      }),
    )
    expect(result.status).toBe(400)
    expect(result.headers.get("Cache-Control")).toBe("no-store")
  }
})
