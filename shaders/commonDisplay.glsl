// functions for display shaders

float
readASCCI(int charID, vec2 coord)
{
  int Xind = charID % 16;
  int Yind = charID / 16;

  float xPos = float(Xind) * 0.0625;
  float yPos = float(Yind) * 0.0625;

  coord.y = 1. - coord.y; // flip vertically

  return length(texture(ASCCI_tex, vec2(coord.x * 0.0625 + xPos, coord.y * 0.0625 + yPos)).xyz);
}

// Color Functions

vec3
hsv2rgb(vec3 c)
{
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
