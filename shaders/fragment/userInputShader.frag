#version 300 es
precision highp float;
precision highp usampler2D;

in vec2 fragCoord;

in vec2 texCoord;     // this
in vec2 texCoordXmY0; // left
in vec2 texCoordX0Ym; // down
in vec2 texCoordXpY0; // right
in vec2 texCoordX0Yp; // up

uniform usampler2D tex;
uniform usampler2D copyTex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform ivec4 userInputValues; // x y type reverse
uniform ivec4 selection;       // startX startY endX endY
uniform ivec2 pasteSize;       // dimensions of the copied texture
uniform int pasteRotation;

out uvec4 dataOut;
ivec4 dataIn;

#define DELETE 100
#define PASTE 101
#define SET_SIGNAL 200

#define ROTATE_0 0
#define ROTATE_90 1
#define ROTATE_180 2
#define ROTATE_270 3

#include "common.glsl"

void main()
{
  ivec2 fragLoc = ivec2(fragCoord);
  dataIn = ivec4(texture(tex, texCoord));

  bool applyInput = false;

  if (selection.x != -1) { // there is a selection
    if (userInputValues[TYPE] == PASTE) {

      // Calculate the position relative to the top-left of the paste area
      ivec2 rel = fragLoc - selection.xy;
      ivec2 copyTexLoc;

      switch (pasteRotation) {
      case ROTATE_0:
        copyTexLoc = rel;
        break;
      case ROTATE_90: // 90° Clockwise
        copyTexLoc = ivec2((pasteSize.x - 1) - rel.y, rel.x);
        break;
      case ROTATE_180:
        copyTexLoc = ivec2((pasteSize.x - 1) - rel.x, (pasteSize.y - 1) - rel.y);
        break;
      case ROTATE_270:
        copyTexLoc = ivec2(rel.y, (pasteSize.y - 1) - rel.x);
        break;
      }
      // Perform bounds check against the source texture dimensions
      if (copyTexLoc.x >= 0 && copyTexLoc.y >= 0 && copyTexLoc.x < pasteSize.x && copyTexLoc.y < pasteSize.y) {

        ivec4 newData = ivec4(texelFetch(copyTex, copyTexLoc, 0));

        if (pasteRotation == ROTATE_90 || pasteRotation == ROTATE_270) { // vertical and horizontal switched
          switch (newData[CELLTYPE]) {
          case CELLTYPE_V2H:
            newData[CELLTYPE] = CELLTYPE_H2V;
            break;
          case CELLTYPE_V2H_N:
            newData[CELLTYPE] = CELLTYPE_H2V_N;
            break;
          case CELLTYPE_H2V:
            newData[CELLTYPE] = CELLTYPE_V2H;
            break;
          case CELLTYPE_H2V_N:
            newData[CELLTYPE] = CELLTYPE_V2H_N;
            break;
          }
        }

        dataIn = newData;
      }


    } else if (inSelection(fragLoc, selection)) {
      if (userInputValues[TYPE] == DELETE) {
        dataIn = ivec4(0);
      } else
        applyInput = true;
    }
  } else if (userInputValues.xy == fragLoc) {
    applyInput = true; // apply to this specific cell
  }

  if (applyInput) {
    if (userInputValues[TYPE] != 0) { // input given

      if (userInputValues[TYPE] == SET_SIGNAL) {
        if (userInputValues[REVERSE] == 1) {
          dataIn[SIGNAL_PRIMA] = 0;
          dataIn[SIGNAL_SECON] = 0;
        } else {
          dataIn[SIGNAL_PRIMA] = packSignal(CENTER, MAX_SIGNAL_STRENGTH);
          dataIn[SIGNAL_SECON] = 0;
        }
      } else {                             // set CELLTYPE
        if (userInputValues[REVERSE] == 1) // remove
          dataIn[CELLTYPE] = CELLTYPE_NONE;
        else if (userInputValues[TYPE] != 1000)
          dataIn[CELLTYPE] = userInputValues[TYPE]; // set type
      }
    }
  }
  dataOut = uvec4(dataIn);
}