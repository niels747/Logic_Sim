#version 300 es
precision highp float;
precision highp isampler2D;

in vec2 fragCoord;

in vec2 texCoord; // this

uniform isampler2D tex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform ivec4 selection; // startX startY endX endY
                         // 100    100    150  150

out ivec4 dataOut;

#include "common.glsl"

void main() {
  ivec2 fragLoc = ivec2(fragCoord);

  ivec2 copyFrom = ivec2(fragLoc.x + selection[0], fragLoc.y + selection[1]);
  //
  // if (copyFrom.x > selection[2] || copyFrom.y > selection[3])
  //   discard;

  // if (selection[0] == 1)
  dataOut = texelFetch(tex, copyFrom, 0);
  // else
  // dataOut = ivec4(fragLoc.y, -1, -1, 0);
}