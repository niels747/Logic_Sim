#version 300 es
precision highp float;
precision highp isampler2D;

in vec2 texCoord;
in vec2 fragCoord;

uniform isampler2D tex;
uniform sampler2D ASCCI_tex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform vec3 view;       // Xpos  Ypos    Zoom
uniform vec4 cursor;     // xpos   Ypos  Size   type

uniform ivec4 selection; // startX startY endX endY

out vec4 fragmentColor;

#include "common.glsl"
#include "commonDisplay.glsl"

#define wireRadius 0.10 // 0.15

float verticalWire(float x) { return step(1. - wireRadius, 1.0 - abs(x - 0.5)); }

float horizontalWire(float y) { return step(1. - wireRadius, 1.0 - abs(y - 0.5)); }

void main()
{
  ivec2 fragLoc = ivec2(fragCoord);
  vec2 local = mod(fragCoord, 1.0); // coordinats within cell

  // if (local.x < 0.1 && local.y < 0.1) { // draw grid
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
  // case CELLTYPE_RESET:
  //   col = vec3(0.7, 0.15, 0.0);
  //   textVal = readASCCI(5 * 16 + 2, local);
  //   break;
  case CELLTYPE_MEM:
    // col = vec3(1.0, 0.5, 0.0);
    // textVal = readASCCI(4 * 16 + 13, local);
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
    if (circuit[CELLTYPE] < 0) { // text
      col = vec3(0.3);           // gray
      textVal = readASCCI(-circuit[CELLTYPE], local);
    } else {
      col = vec3(1, 0, 0);                     // red to indicate invalid celltype
      textVal = readASCCI(3 * 16 + 15, local); // ?
    }
  }

  float wire = min(Xwire + Ywire, 1.0);

  const vec3 wireOffCol = vec3(0.3, 0.3, 0); // dark green
  const vec3 wireOnCol = vec3(0.3, 1.0, 0);  // light green

  col += wire * wireOffCol;

  col += vec3(textVal);

  if (inSelection(fragLoc, selection)) {
    col += 0.3;
  }

  // if ((circuit[SIGNAL_PRIMA] > -1 || circuit[SIGNAL_SECON] > -1) && wire > 0.0)
  //   col.g = 1.;

  // if (circuit[CELLTYPE] == CELLTYPE_BRIDGE || circuit[CELLTYPE] == CELLTYPE_INPUT || circuit[CELLTYPE] == CELLTYPE_H2V || circuit[CELLTYPE] == CELLTYPE_H2V_N || circuit[CELLTYPE] == CELLTYPE_V2H || circuit[CELLTYPE] == CELLTYPE_V2H_N) { // show signal on line

  if (col.r > 0.5) {
    col = vec3(1.);
  } else if (col.g > 0.5) {
    if ((circuit[SIGNAL_PRIMA] > -1)) // Ywire > 0.0
      col = wireOnCol;
    else
      col = wireOffCol;
  } else if (col.b > 0.5) {
    if ((circuit[SIGNAL_SECON] > -1)) // Xwire > 0.0
      col = wireOnCol;
    else
      col = wireOffCol;
  }
  // } else if (circuit[SIGNAL_PRIMA] > -1) { // show signal on whole cell

  //                                          // col = wireOnCol;
  // }

  fragmentColor = vec4(col, 1);
}