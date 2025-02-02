export const getErrorSvg = (err: string) => {
  const splitMessage = (msg: string): string[] => {
    msg = msg.includes(":") ? msg.replace(/[^:]+:/, "") : msg;
    const chunks: string[] = [];
    let currentChunk = "";
    msg.split(" ").forEach((word) => {
      if ((currentChunk + word).length > 33) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      currentChunk += `${word} `;
    });
    chunks.push(currentChunk.trim());
    return chunks;
  };

  const errorLines = splitMessage(err);
  const lineHeight = 24;
  const topMargin = 50;
  const bottomMargin = 20;
  const horizontalPadding = 40;
  const estimatedCharWidth = 8;
  const maxLineLength = errorLines.reduce(
    (max, line) => Math.max(max, line.length),
    0,
  );
  const dynamicWidth = maxLineLength * estimatedCharWidth + horizontalPadding;
  const dynamicHeight =
    topMargin + errorLines.length * lineHeight + bottomMargin;
  const desiredRatio = 16 / 9;
  let finalWidth = dynamicWidth;
  let finalHeight = dynamicHeight;
  if (dynamicWidth / dynamicHeight < desiredRatio) {
    finalWidth = dynamicHeight * desiredRatio;
  } else if (dynamicWidth / dynamicHeight > desiredRatio) {
    finalHeight = dynamicWidth / desiredRatio;
  }
  const viewBox = `0 0 ${finalWidth} ${finalHeight}`;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <rect width="100%" height="100%" fill="#FEF2F2"/>
    <style>
      .error-subtext {
        font: 400 16px/1.4 'Segoe UI', system-ui, sans-serif;
        fill: #dc2626;
      }
    </style>
    <g transform="translate(0, ${topMargin})">
      <text x="50%" y="0" class="error-subtext" text-anchor="middle">
        ${errorLines.map((line, i) => `<tspan x="50%" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`).join("")}
      </text>
    </g>
  </svg>`.trim();
};
