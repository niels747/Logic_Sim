#version 300 es
precision highp float;
precision highp isampler2D;

in vec2 texCoord;
in vec2 fragCoord;

uniform isampler2D tex;
uniform sampler2D ASCCI_tex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform vec3 view;   // Xpos  Ypos    Zoom
uniform vec4 cursor; // xpos   Ypos  Size   type

uniform ivec4 selection; // startX startY endX endY

out vec4 fragmentColor;

#include "common.glsl"
#include "commonDisplay.glsl"

void
main()
{
  ivec2 fragLoc = ivec2(fragCoord);
  float localX = mod(fragCoord.x, 1.0);
  float localY = mod(fragCoord.y, 1.0);

  // if (localX < 0.1 && localY < 0.1) { // draw grid
  //   fragmentColor = vec4(1, 0, 0, 0);
  //   return;
  // }

  ivec4 circuit = texture(tex, texCoord);

  float wire = 0.1;
  float signal = 0.;

  float texcol = 0.0;

  vec3 col = vec3(0);

  switch (circuit[CELLTYPE]) {
  case CELLTYPE_WIRE:
    col += vec3(0.3, 0.3, 0);        // yellow wire
    switch (circuit[SIGNAL_PRIMA]) { // signal direction
    case CENTER:
      texcol = readASCCI(7, vec2(localX, localY)); // this
      break;
    case LEFT:
      texcol = readASCCI(26, vec2(localX, localY)); // >
      break;
    case RIGHT:
      texcol = readASCCI(27, vec2(localX, localY)); // <
      break;
    case UP:
      texcol = readASCCI(25, vec2(localX, localY)); // v
      break;
    case DOWN:
      texcol = readASCCI(24, vec2(localX, localY)); // ^
      break;
    }
    break;
  case CELLTYPE_BRIDGE:
    col += vec3(0.3, 0.0, 0.3); // purple interconnect
    texcol = readASCCI(13 * 16 + 15, vec2(localX, localY));
    break;
  case CELLTYPE_INPUT:
    col += vec3(0.9, 0.9, 0.0); // Bright yellow
    texcol = readASCCI(12 * 16, vec2(localX, localY));
    break;
  case CELLTYPE_OR:
    texcol = readASCCI(12 * 16 + 2, vec2(localX, localY)); // ≥1
    break;
  case CELLTYPE_NOR:
    texcol = readASCCI(12 * 16 + 3, vec2(localX, localY)); // =0
    break;
  case CELLTYPE_AND:
    texcol = readASCCI(12 * 16 + 4, vec2(localX, localY)); // &
    break;
  case CELLTYPE_NAND:
    texcol = readASCCI(12 * 16 + 5, vec2(localX, localY)); // &!
    break;
  case CELLTYPE_XOR:
    texcol = readASCCI(12 * 16 + 6, vec2(localX, localY)); // =1
    break;
  case CELLTYPE_XNOR:
    texcol = readASCCI(12 * 16 + 8, vec2(localX, localY)); // !=1
    break;
  case CELLTYPE_SUM:
    texcol = readASCCI(43, vec2(localX, localY)); // +
    break;
  case CELLTYPE_CARRY:
    texcol = readASCCI(94, vec2(localX, localY)); // +
    break;
  }

  col += vec3(texcol + wire);

  if (inSelection(fragLoc, selection)) {
    col += 0.3;
  }

  if (circuit[SIGNAL_PRIMA] > -1 || circuit[SIGNAL_SECON] > -1)
    col.g = 1.;

  fragmentColor = vec4(col, 1);
}