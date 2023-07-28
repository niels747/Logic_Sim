#version 300 es
precision highp float;
precision highp usampler2D;

in vec2 texCoord;
in vec2 fragCoord;

uniform usampler2D tex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform vec3 view;   // Xpos  Ypos    Zoom
uniform vec4 cursor; // xpos   Ypos  Size   type

out vec4 fragmentColor;

#include "common.glsl"

void main() {
  uvec4 circuit = texture(tex, texCoord);
  fragmentColor = vec4(1);
}