#version 300 es
precision highp float;

uniform vec2 resolution;
uniform vec2 texelSize;

in vec2 texCoord;
in vec2 fragCoord;

// ivec2 fragLoc;

out ivec4 dataOut;

#include "common.glsl"

void main() {
  ivec2 fragLoc = ivec2(fragCoord);
  ivec4 data = ivec4(0, -1, -1, 0);

  for (int i = 0; i < 8; i++) { // create all getes with 3 inputs
    int Y = i * 7;
    if ((fragLoc.y == 1 + Y || fragLoc.y == 5 + Y) && fragLoc.x < 21) {
      data[CELLTYPE] = CELLTYPE_WIRE;
    }
    if ((fragLoc.y == 2 + Y || fragLoc.y == 4 + Y) && fragLoc.x == 20) {
      data[CELLTYPE] = CELLTYPE_INPUT;
    }
    if (fragLoc.y == 3 + Y) {
      if (fragLoc.x < 19 || fragLoc.x > 20)
        data[CELLTYPE] = CELLTYPE_WIRE;
      else if (fragLoc.x == 19)
        data[CELLTYPE] = CELLTYPE_INPUT;
      else if (fragLoc.x == 20)
        data[CELLTYPE] = i + 10;
    }
  }

  if (fragLoc.x == 50) {
    data[CELLTYPE] = CELLTYPE_WIRE;
    if ((fragLoc.y + 4) % 7 == 0)
      data[CELLTYPE] = CELLTYPE_BRIDGE;
  }
  dataOut = data;
}