#version 300 es
precision highp float;
precision highp usampler2D;

in vec2 texCoord;     // this
in vec2 texCoordXmY0; // left
in vec2 texCoordX0Ym; // down
in vec2 texCoordXpY0; // right
in vec2 texCoordX0Yp; // up

in vec2 fragCoord;

uniform usampler2D tex;
uniform sampler2D ASCCI_tex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform vec3 view;             // Xpos  Ypos    Zoom
uniform ivec4 userInputValues; // x y type reverse

uniform int frameNum;

uniform ivec4 selection; // startX startY endX endY

out vec4 fragmentColor;

#include "common.glsl"
#include "commonDisplay.glsl"

#define wireRadius 0.10 // 0.15

float verticalWire(float x) { return step(1. - wireRadius, 1.0 - abs(x - 0.5)); }

float horizontalWire(float y) { return step(1. - wireRadius, 1.0 - abs(y - 0.5)); }

ivec4 dataIn[6];

void main()
{
  ivec2 fragLoc = ivec2(fragCoord);
  vec2 local = mod(fragCoord, 1.0); // coordinats within cell

  dataIn[CENTER] = ivec4(texture(tex, texCoord));

  dataIn[LEFT] = ivec4(texture(tex, texCoordXmY0));
  dataIn[DOWN] = ivec4(texture(tex, texCoordX0Ym));
  dataIn[RIGHT] = ivec4(texture(tex, texCoordXpY0));
  dataIn[UP] = ivec4(texture(tex, texCoordX0Yp));

  float Xwire = 0.;
  float Ywire = 0.;

  float signal = 0.;
  float textVal = 0.;

  vec3 col = vec3(0.4);

  switch (dataIn[CENTER][CELLTYPE]) {
  case CELLTYPE_NONE:
    col = vec3(0);
    break;
  case CELLTYPE_WIRE:
  case CELLTYPE_DISP:
    col = vec3(0., 1., 0.);
    break;
  case CELLTYPE_BRIDGE:
    // col = vec3(0., horizontalWire(local.y), verticalWire(local.x));
    col = readASCCIcol(10 * 16 + 0, local);
    break;
  case CELLTYPE_H2V:
    col = readASCCIcol(10 * 16 + 3, local);
    textVal = 0.;
    break;
  case CELLTYPE_H2V_N:
    col = readASCCIcol(10 * 16 + 4, local);
    break;
  case CELLTYPE_V2H:
    col = readASCCIcol(10 * 16 + 1, local);
    break;
  case CELLTYPE_V2H_N:
    col = readASCCIcol(10 * 16 + 2, local);
    break;
  case CELLTYPE_INPUT:
    // col = vec3(0.9, 0.9, 0.0); // yellow
    col = readASCCIcol(12 * 16, local);
    break;
  case CELLTYPE_CLK_INPUT:
    int dir = LEFT;
    while (dir <= UP) {
      if (dataIn[dir][CELLTYPE] == CELLTYPE_MEM)
        break;
      dir++;
    }
    col = readASCCIcol(10 * 16 + 8 + dir, local); // arrow pointing to memory cell
    break;
  case CELLTYPE_MEM:
    col = readASCCIcol(10 * 16 + 14, local);
    break;
  case CELLTYPE_CLK:
    col = readASCCIcol(10 * 16 + 5, local);
    break;
  case CELLTYPE_CLK_2:
    col = readASCCIcol(10 * 16 + 6, local);
    break;
  case CELLTYPE_CLK_4:
    col = readASCCIcol(10 * 16 + 7, local);
    break;
  case CELLTYPE_CLK_8:
    col = readASCCIcol(10 * 16 + 8, local);
    break;
  case CELLTYPE_OR:
    textVal = readASCCI(12 * 16 + 2, local); // ≥1
    break;
  case CELLTYPE_NOR:
    textVal = readASCCI(12 * 16 + 3, local); // =0
    break;
  case CELLTYPE_AND:
    textVal = readASCCI(12 * 16 + 4, local); // &
    break;
  case CELLTYPE_NAND:
    textVal = readASCCI(12 * 16 + 5, local); // &!
    break;
  case CELLTYPE_XOR:
    textVal = readASCCI(12 * 16 + 6, local); // =1
    break;
  case CELLTYPE_XNOR:
    textVal = readASCCI(12 * 16 + 8, local); // !=1
    break;
  case CELLTYPE_SUM:
    textVal = readASCCI(43, local); // +
    break;
  case CELLTYPE_CARRY:
    textVal = readASCCI(94, local); // +
    break;
  default:
    if (dataIn[CENTER][CELLTYPE] >= 1000) { // text
      textVal = readASCCI(dataIn[CENTER][CELLTYPE] - 1000, local);
    } else {
      col = vec3(1, 0, 0);                     // red to indicate invalid celltype
      textVal = readASCCI(3 * 16 + 15, local); // ?
    }
  }

  if (userInputValues.xy == fragLoc.xy && userInputValues[2] >= 1000 && local.x < 0.1 && frameNum % 60 < 30)
    col += vec3(1.); // cursor

  float wire = min(Xwire + Ywire, 1.0);

  const vec3 wireOffCol = vec3(0.3, 0.3, 0); // dark green
  const vec3 wireOnCol = vec3(0.3, 1.0, 0);  // light green

  const vec3 displayOnCol = vec3(1.0, 0., 0);

  col += wire * wireOffCol;

  col += vec3(textVal);

  if (inSelection(fragLoc, selection)) {
    col += 0.3;
  }

  if (col.r > 0.5) {
    col = vec3(1.);
  } else if (col.g > 0.5) {
    if (getStrength(dataIn[CENTER][SIGNAL_PRIMA]) > 0) {
      if (dataIn[CENTER][CELLTYPE] == CELLTYPE_DISP)
        col = displayOnCol;
      else
        col = wireOnCol;
    } else {
      if (dataIn[CENTER][CELLTYPE] == CELLTYPE_DISP)
        col = displayOnCol * 0.1;
      else
        col = wireOffCol;
    }
  } else if (col.b > 0.5) {
    if ((dataIn[CENTER][SIGNAL_SECON] > 0)) // Xwire > 0.0
      col = wireOnCol;
    else
      col = wireOffCol;
  }

  fragmentColor = vec4(col, 1);
}