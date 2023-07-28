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

uniform vec2 resolution;
uniform vec2 texelSize;

uniform int IterNum;

out ivec4 dataOut;

ivec4 dataIn[5];

#include "common.glsl"

#define SIG_RES -6 // what [SIGNAL] is set to after signal is lost.

// checks if a celltype takes input from other celltype
/*
bool
takesInput(int thisType, int otherType)
{
  if (thisType >= 10) {                   // logic gate
    return (otherType == CELLTYPE_INPUT); // only take input from inputs
  } else {
    switch (thisType) {
    case CELLTYPE_WIRE: // takes input from wire, bridge or logic gates
      return (otherType == CELLTYPE_WIRE || otherType == CELLTYPE_BRIDGE || otherType >= 10);
      break;
    case CELLTYPE_INPUT:
      return (otherType == CELLTYPE_WIRE); // or interconnect?
      break;
    }
  }
}
*/
bool
getWireInput(int dir)
{
  int sig = -1;
  if (dataIn[dir][CELLTYPE] >= 10) { // logic gate or memory type
    sig = dataIn[dir][SIGNAL_PRIMA];
  } else
    switch (dataIn[dir][CELLTYPE]) {
    case CELLTYPE_WIRE:
      sig = dataIn[dir][SIGNAL_PRIMA];
      break;
    case CELLTYPE_CLK:
      sig = dataIn[dir][SIGNAL_PRIMA];
      break;
    case CELLTYPE_BRIDGE:
    case CELLTYPE_H2V:
    case CELLTYPE_H2V_N: 
    case CELLTYPE_V2H:
    case CELLTYPE_V2H_N:
      if (dir == LEFT || dir == RIGHT) // take directional signal
        sig = dataIn[dir][SIGNAL_PRIMA]; // horizontal
      else
        sig = dataIn[dir][SIGNAL_SECON]; // vertical
      break;
    }
  return (sig >= 0);
}

bool
getInputInput(int dir)
{ // get input for input cell
  int sig = -1;
  switch (dataIn[dir][CELLTYPE]) {
  case CELLTYPE_WIRE:
    sig = dataIn[dir][SIGNAL_PRIMA];
    break;
  case CELLTYPE_BRIDGE:
    if (dir == LEFT || dir == RIGHT)
      sig = dataIn[dir][SIGNAL_PRIMA];
    else
      sig = dataIn[dir][SIGNAL_SECON];
    break;
  }
  return (sig >= 0);
}

void
main()
{
  dataIn[CENTER] = texture(tex, texCoord);    // 0
  int cell_type = dataIn[CENTER][CELLTYPE];

 // if(cell_type == CELLTYPE_NONE) // optimization causes delete bug
  //  discard;

  dataIn[LEFT] = texture(tex, texCoordXmY0);  // 1
  dataIn[DOWN] = texture(tex, texCoordX0Ym);  // 2
  dataIn[RIGHT] = texture(tex, texCoordXpY0); // 3
  dataIn[UP] = texture(tex, texCoordX0Yp);    // 4

  if (cell_type >= 10) { // logic gate or memory type
  // read inputs:
    int numInputs = 0, numHigh = 0; 
    if (dataIn[LEFT][CELLTYPE] == CELLTYPE_INPUT) {
      numInputs++;
      if (dataIn[LEFT][SIGNAL_PRIMA] >= 0) // -1 is low 0 is high!
        numHigh++;
    }
    if (dataIn[DOWN][CELLTYPE] == CELLTYPE_INPUT) {
      numInputs++;
      if (dataIn[DOWN][SIGNAL_PRIMA] >= 0)
        numHigh++;
    }
    if (dataIn[RIGHT][CELLTYPE] == CELLTYPE_INPUT) {
      numInputs++;
      if (dataIn[RIGHT][SIGNAL_PRIMA] >= 0)
        numHigh++;
    }
    if (dataIn[UP][CELLTYPE] == CELLTYPE_INPUT) {
      numInputs++;
      if (dataIn[UP][SIGNAL_PRIMA] >= 0)
        numHigh++;
    }

    if (numInputs == 0 && cell_type != CELLTYPE_MEM) { // no inputs
      dataIn[CENTER][SIGNAL_PRIMA] = -1;               // no signal
    } else
      switch (cell_type) {
      case CELLTYPE_OR:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh > 0) - 1; // ≥1
        break;
      case CELLTYPE_NOR:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh == 0) - 1; // =0
        break;
      case CELLTYPE_AND:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh == numInputs) - 1; // &
        break;
      case CELLTYPE_NAND:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh != numInputs) - 1; // &!
        break;
      case CELLTYPE_XOR:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh == 1) - 1; // =1
        break;
      case CELLTYPE_XNOR:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh != 1) - 1; // !=1
        break;
      case CELLTYPE_SUM:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh == 1 || numHigh == 3) - 1;
        break;
      case CELLTYPE_CARRY:
        dataIn[CENTER][SIGNAL_PRIMA] = int(numHigh >= 2) - 1;
        break;
      case CELLTYPE_MEM:
        if (dataIn[CENTER][SIGNAL_PRIMA] < 0) {    // is low
            if (numHigh == 2){ // set high
              dataIn[CENTER][SIGNAL_PRIMA] = 0;
              dataIn[CENTER][SIGNAL_SECON] = 0; // make not resetable
            }
        } else {                               // is high
        if (dataIn[CENTER][SIGNAL_SECON] >= 0) { // not resettable
            if (numHigh == 0)                      // Make resettable
              dataIn[CENTER][SIGNAL_SECON] = -1;
          } else {            // resettable
            if (numHigh == 1) // reset
              dataIn[CENTER][SIGNAL_PRIMA] = -1; // set low
          }
        }
        break;
      default:
        dataIn[CENTER][SIGNAL_PRIMA] = -1; // no signal
      }
  } else {
    switch (cell_type) {
    case CELLTYPE_WIRE:

      if (dataIn[CENTER][SIGNAL_PRIMA] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_PRIMA]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_PRIMA] == -1) { // low, open to recieve

        if (getWireInput(LEFT))
          dataIn[CENTER][SIGNAL_PRIMA] = LEFT; // set left as source
        else if (getWireInput(RIGHT))
          dataIn[CENTER][SIGNAL_PRIMA] = RIGHT;
        else if (getWireInput(UP))
          dataIn[CENTER][SIGNAL_PRIMA] = UP;
        else if (getWireInput(DOWN))
          dataIn[CENTER][SIGNAL_PRIMA] = DOWN;

      } else { // already has signal source

        if (dataIn[CENTER][SIGNAL_PRIMA] == CENTER) {           // this is source
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // turn of source
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_PRIMA])) // if source lost signal
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // this also loses signal
      }
      dataIn[CENTER][SIGNAL_SECON] = -1; // turn of secondary signal, not used
      break;
    case CELLTYPE_BRIDGE:

      // HORIZONTAL SIGNAL
      if (dataIn[CENTER][SIGNAL_PRIMA] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_PRIMA]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_PRIMA] == -1) { // low, open to recieve
        if (getWireInput(LEFT))
          dataIn[CENTER][SIGNAL_PRIMA] = LEFT; // set left as source
        else if (getWireInput(RIGHT))
          dataIn[CENTER][SIGNAL_PRIMA] = RIGHT;
      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_PRIMA] == CENTER) {           // this is source
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // turn of source
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_PRIMA])) // if source lost signal
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // this also loses signal
      }

      // VERTICAL SIGNAL
      if (dataIn[CENTER][SIGNAL_SECON] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_SECON]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_SECON] == -1) { // low, open to recieve

        if (getWireInput(DOWN))
          dataIn[CENTER][SIGNAL_SECON] = DOWN;
        else if (getWireInput(UP))
          dataIn[CENTER][SIGNAL_SECON] = UP;
      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_SECON] == CENTER) { // this is source
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;     // turn of source
          // lostSignal(int dir) { return dataIn[dir][SIGNAL_PRIMA] <= -1
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_SECON])) // if source lost signal
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;               // this also loses signal
      }

      break;
      case CELLTYPE_H2V:

      // HORIZONTAL SIGNAL
      if (dataIn[CENTER][SIGNAL_PRIMA] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_PRIMA]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_PRIMA] == -1) { // low, open to recieve
        if (getWireInput(LEFT))
          dataIn[CENTER][SIGNAL_PRIMA] = LEFT; // set left as source
        else if (getWireInput(RIGHT))
          dataIn[CENTER][SIGNAL_PRIMA] = RIGHT;
      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_PRIMA] == CENTER) {           // this is source
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // turn of source
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_PRIMA])) // if source lost signal
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // this also loses signal
      }

      // VERTICAL SIGNAL
      if (dataIn[CENTER][SIGNAL_SECON] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_SECON]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_SECON] == -1) { // low, open to recieve

        if (getWireInput(DOWN))
          dataIn[CENTER][SIGNAL_SECON] = DOWN;
        else if (getWireInput(UP))
          dataIn[CENTER][SIGNAL_SECON] = UP;

        // take input from horizontal input and put into vertical signal
        else if (getWireInput(LEFT))
          dataIn[CENTER][SIGNAL_SECON] = LEFT;
        else if (getWireInput(RIGHT))
          dataIn[CENTER][SIGNAL_SECON] = RIGHT;

      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_SECON] == CENTER) { // this is source
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;     // turn of source
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_SECON])) // if source lost signal
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;               // this also loses signal
      }

      break;
      case CELLTYPE_H2V_N:

      // HORIZONTAL SIGNAL
      if (dataIn[CENTER][SIGNAL_PRIMA] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_PRIMA]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_PRIMA] == -1) { // low, open to recieve
        if (getWireInput(LEFT))
          dataIn[CENTER][SIGNAL_PRIMA] = LEFT; // set left as source
        else if (getWireInput(RIGHT))
          dataIn[CENTER][SIGNAL_PRIMA] = RIGHT;
      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_PRIMA] == CENTER) {           // this is source
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // turn of source
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_PRIMA])) // if source lost signal
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // this also loses signal
      }

      // VERTICAL SIGNAL
      if (dataIn[CENTER][SIGNAL_SECON] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_SECON]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_SECON] == -1) { // low, open to recieve

        if (getWireInput(DOWN))
          dataIn[CENTER][SIGNAL_SECON] = DOWN;
        else if (getWireInput(UP))
          dataIn[CENTER][SIGNAL_SECON] = UP;

        // take input from horizontal input and put into vertical signal
        else if (!getWireInput(LEFT))
          dataIn[CENTER][SIGNAL_SECON] = LEFT;
        else if (!getWireInput(RIGHT))
          dataIn[CENTER][SIGNAL_SECON] = RIGHT;

      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_SECON] == CENTER) { // this is source
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;     // turn of source
        } else{ // other source

        switch(dataIn[CENTER][SIGNAL_SECON])
        {
         case UP:
         case DOWN:
        if(!getWireInput(dataIn[CENTER][SIGNAL_SECON])) // has no signal
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;       // this also loses signal
        break;

        case LEFT:
        case RIGHT:
        if(getWireInput(dataIn[CENTER][SIGNAL_SECON])) // has signal
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;       // this loses signal because inverted

        break;
        }
        }
      }

      break;
      case CELLTYPE_V2H:

      // HORIZONTAL SIGNAL
      if (dataIn[CENTER][SIGNAL_PRIMA] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_PRIMA]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_PRIMA] == -1) { // low, open to recieve
        if (getWireInput(LEFT))
          dataIn[CENTER][SIGNAL_PRIMA] = LEFT; // set left as source
        else if (getWireInput(RIGHT))
          dataIn[CENTER][SIGNAL_PRIMA] = RIGHT;


        // take input from vertical input and put into horizontal signal
        else if (getWireInput(DOWN))
          dataIn[CENTER][SIGNAL_PRIMA] = DOWN;
        else if (getWireInput(UP))
          dataIn[CENTER][SIGNAL_PRIMA] = UP;



      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_PRIMA] == CENTER) {           // this is source
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // turn of source
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_PRIMA])) // if source lost signal
          dataIn[CENTER][SIGNAL_PRIMA] = SIG_RES;               // this also loses signal
      }

      // VERTICAL SIGNAL
      if (dataIn[CENTER][SIGNAL_SECON] < -1) {         // imune from signal
        dataIn[CENTER][SIGNAL_SECON]++;                // count back up to 0 to reset
      } else if (dataIn[CENTER][SIGNAL_SECON] == -1) { // low, open to recieve

        if (getWireInput(DOWN))
          dataIn[CENTER][SIGNAL_SECON] = DOWN;
        else if (getWireInput(UP))
          dataIn[CENTER][SIGNAL_SECON] = UP;

      } else { // already has signal source
        if (dataIn[CENTER][SIGNAL_SECON] == CENTER) { // this is source
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;     // turn of source
        } else if (!getWireInput(dataIn[CENTER][SIGNAL_SECON])) // if source lost signal
          dataIn[CENTER][SIGNAL_SECON] = SIG_RES;               // this also loses signal
      }

      break;
    case CELLTYPE_INPUT:
      if (getInputInput(LEFT))
        dataIn[CENTER][SIGNAL_PRIMA] = 0; // set high
      else if (getInputInput(RIGHT))
        dataIn[CENTER][SIGNAL_PRIMA] = 0; // set high
      else if (getInputInput(UP))
        dataIn[CENTER][SIGNAL_PRIMA] = 0; // set high
      else if (getInputInput(DOWN))
        dataIn[CENTER][SIGNAL_PRIMA] = 0; // set high
      else
        dataIn[CENTER][SIGNAL_PRIMA] = -1; // set low

      break;
    case CELLTYPE_CLK:
      int dutyCycle = 600;
      bool isHigh = IterNum % dutyCycle > dutyCycle / 2;
      dataIn[CENTER][SIGNAL_PRIMA] = int(isHigh) - 1;
      break;
    case CELLTYPE_NONE:
    default:                           
      dataIn[CENTER][SIGNAL_PRIMA] = -1; // no signal
      dataIn[CENTER][SIGNAL_SECON] = -1; // no signal
    }
  }
  dataOut = dataIn[CENTER];
}