export function drawPos(x, y, z, r, g, b) {
  Renderer.disableDepth();
  Renderer3d.begin(
    Renderer.DrawMode.QUADS,
    Renderer.VertexFormat.POSITION_COLOR,
  );

  const faces = [
    [x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1],
    [x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z],
    [x, y, z, x, y + 1, z, x + 1, y + 1, z, x + 1, y, z],
    [x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1, x, y, z + 1],
    [x, y, z + 1, x, y + 1, z + 1, x, y + 1, z, x, y, z],
    [x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1, x + 1, y, z + 1],
  ];

  faces.forEach((f) => {
    for (let i = 0; i < f.length; i += 3) {
      Renderer3d.pos(f[i], f[i + 1], f[i + 2]).color(
        Renderer.fixAlpha(Renderer.getColor(r, g, b, 255)),
      );
    }
  });

  Renderer3d.draw();
  Renderer.enableDepth();
}
