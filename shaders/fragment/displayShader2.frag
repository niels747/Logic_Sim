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

#define wireRadius 0.10 // 0.15

float
verticalWire(float x)
{
  return step(1. - wireRadius, 1.0 - abs(x - 0.5));
}

float
horizontalWire(float y)
{
  return step(1. - wireRadius, 1.0 - abs(y - 0.5));
}

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

  float Xwire = 0.;
  float Ywire = 0.;

  float signal = 0.;
  float textVal = 0.;

  vec3 col = vec3(0.4);

  switch (circuit[CELLTYPE]) {
  case CELLTYPE_NONE:
    col = vec3(0);
    break;
  case CELLTYPE_WIRE:
    Ywire = 1.;
    col = vec3(0.);
    break;
  case CELLTYPE_BRIDGE:
    Xwire = verticalWire(localX);
    Ywire = horizontalWire(localY);
    col = vec3(0.);
    break;
    case CELLTYPE_H2V:
    Xwire = verticalWire(localX);
    Ywire = horizontalWire(localY);
    col = vec3(0.,0.0,0.3);
    break;
    case CELLTYPE_H2V_N:
    Xwire = verticalWire(localX);
    Ywire = horizontalWire(localY);
    col = vec3(0.3,0.,0.);
    break;
    case CELLTYPE_V2H:
    Xwire = verticalWire(localX);
    Ywire = horizontalWire(localY);
    col = vec3(0.,0.0,0.3);
    break;
    case CELLTYPE_V2H_N:
    Xwire = verticalWire(localX);
    Ywire = horizontalWire(localY);
    col = vec3(0.3,0.,0.);
    break;
  case CELLTYPE_INPUT:
    col = vec3(0.9, 0.9, 0.0); // yellow
    textVal = readASCCI(12 * 16, vec2(localX, localY));
    break;
  // case CELLTYPE_RESET:
  //   col = vec3(0.7, 0.15, 0.0);
  //   textVal = readASCCI(5 * 16 + 2, vec2(localX, localY));
  //   break;
  case CELLTYPE_MEM:
    col = vec3(1.0, 0.5, 0.0);
    textVal = readASCCI(4 * 16 + 13, vec2(localX, localY));
    break;
  case CELLTYPE_CLK:
    col = vec3(0.0, 0.2, 1.0);
    // textVal = readASCCI(12 * 16, vec2(localX, localY));
    break;
  case CELLTYPE_OR:
    textVal = readASCCI(12 * 16 + 2, vec2(localX, localY)); // ≥1
    break;
  case CELLTYPE_NOR:
    textVal = readASCCI(12 * 16 + 3, vec2(localX, localY)); // =0
    break;
  case CELLTYPE_AND:
    textVal = readASCCI(12 * 16 + 4, vec2(localX, localY)); // &
    break;
  case CELLTYPE_NAND:
    textVal = readASCCI(12 * 16 + 5, vec2(localX, localY)); // &!
    break;
  case CELLTYPE_XOR:
    textVal = readASCCI(12 * 16 + 6, vec2(localX, localY)); // =1
    break;
  case CELLTYPE_XNOR:
    textVal = readASCCI(12 * 16 + 8, vec2(localX, localY)); // !=1
    break;
  case CELLTYPE_SUM:
    textVal = readASCCI(43, vec2(localX, localY)); // +
    break;
  case CELLTYPE_CARRY:
    textVal = readASCCI(94, vec2(localX, localY)); // +
    break;
  default:
    col = vec3(1, 0, 0);                                    // red to indicate invalid celltype
    textVal = readASCCI(3 * 16 + 15, vec2(localX, localY)); // ?
  }

  float wire = min(Xwire + Ywire, 1.0);

  col += wire * vec3(0.3, 0.3, 0);

  col += vec3(textVal);

  if (inSelection(fragLoc, selection)) {
    col += 0.3;
  }

  // if ((circuit[SIGNAL_PRIMA] > -1 || circuit[SIGNAL_SECON] > -1) && wire > 0.0)
  //   col.g = 1.;

  if (circuit[CELLTYPE] == CELLTYPE_BRIDGE || circuit[CELLTYPE] == CELLTYPE_H2V || circuit[CELLTYPE] == CELLTYPE_H2V_N  || circuit[CELLTYPE] == CELLTYPE_V2H || circuit[CELLTYPE] == CELLTYPE_V2H_N) { // show signal on line
    if ((circuit[SIGNAL_PRIMA] > -1) && Ywire > 0.0)
      // col.r = 1.;
      col.g = 1.;

    if ((circuit[SIGNAL_SECON] > -1) && Xwire > 0.0)
      //   col.r = 1.;
      col.g = 1.;
  } else if (circuit[SIGNAL_PRIMA] > -1) { // show signal on whole cell
    //  col.r = 1.;
    col.g = 1.;
  }

  fragmentColor = vec4(col, 1);
}