#version 300 es
precision highp float;

in vec2 vertPosition;
in vec2 vertTexCoord;

uniform vec2 texelSize;

uniform vec2 aspectRatios; // sim   canvas
uniform vec3 view;         // Xpos  Ypos    Zoom

out vec2 texCoord;         // normalized
out vec2 texCoordXmY0;     // left
out vec2 texCoordXpY0;     // right
out vec2 texCoordX0Yp;     // up
out vec2 texCoordX0Ym;     // down

out vec2 fragCoord;        // non normalized fragment coordinate


void main()
{
  fragCoord = vertTexCoord;
  texCoord = vertTexCoord * texelSize; // normalize

  texCoordXmY0 = texCoord + vec2(-texelSize.x, 0.0);
  texCoordXpY0 = texCoord + vec2(texelSize.x, 0.0);
  texCoordX0Yp = texCoord + vec2(0.0, texelSize.y);
  texCoordX0Ym = texCoord + vec2(0.0, -texelSize.y);

  vec2 outpos = vertPosition;

  outpos.x += view.x;
  outpos.y += view.y * aspectRatios[0];

  outpos *= view[2]; // .z zoom

  outpos.y *= aspectRatios[1] / aspectRatios[0];

  gl_Position = vec4(outpos, 0.0, 1.0);
}