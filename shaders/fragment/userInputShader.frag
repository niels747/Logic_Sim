#version 300 es
precision highp float;
precision highp isampler2D;

in vec2 fragCoord;

in vec2 texCoord;     // this
in vec2 texCoordXmY0; // left
in vec2 texCoordX0Ym; // down
in vec2 texCoordXpY0; // right
in vec2 texCoordX0Yp; // up

uniform isampler2D tex;
uniform isampler2D copyTex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform ivec4 userInputValues; // x y type reverse
uniform ivec4 selection;       // startX startY endX endY
uniform ivec2 pasteSize;       // dimensions of the copied texture

out ivec4 dataOut;

#define DELETE 100
#define PASTE  101

#include "common.glsl"

void
main()
{
  ivec2 fragLoc = ivec2(fragCoord);
  dataOut = texture(tex, texCoord);

  bool applyInput = false;

  if (selection.x != -1) {           // there is a selection
    if (userInputValues[TYPE] == PASTE) { // paste

      ivec2 loc = ivec2(fragLoc.x - selection.x, fragLoc.y - selection.y);
      if (loc.x >= 0 && loc.y >= 0 && loc.x <= pasteSize.x + 1 && loc.y <= pasteSize.y + 1) {
        dataOut = texelFetch(copyTex, loc, 0);
      }
    } else if (inSelection(fragLoc, selection)) {
      if (userInputValues[TYPE] == DELETE) { // delete
        dataOut = ivec4(0, -1, -1, 0);
      } else
        applyInput = true;
    }
  } else if (userInputValues.xy == fragLoc) {
    applyInput = true; // apply to single cell
  }

  if (applyInput) {
    if (userInputValues[TYPE] > 0) { // input given

      if (userInputValues[TYPE] == 1000) { // set signal
        if (userInputValues[REVERSE] == 1) {
          dataOut[SIGNAL_PRIMA] = -1;
          dataOut[SIGNAL_SECON] = -1;
        } else {
          dataOut[SIGNAL_PRIMA] = 0;
          dataOut[SIGNAL_SECON] = 0;
        }
      } else {                       // set CELLTYPE
        if (userInputValues[REVERSE] == 1) // remove
          dataOut[CELLTYPE] = CELLTYPE_NONE;
        else
          dataOut[CELLTYPE] = userInputValues[TYPE]; // set type
      }
    }
  }
}