#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

in vec2 fragCoord;

in vec2 texCoord;     // this
in vec2 texCoordXmY0; // left
in vec2 texCoordX0Ym; // down
in vec2 texCoordXpY0; // right
in vec2 texCoordX0Yp; // up

uniform usampler2D tex;

uniform vec2 resolution;
uniform vec2 texelSize;

uniform int IterNum;

out uvec4 dataOut;

ivec4 dataIn[6];

#include "common.glsl"

// Clock:
uniform int clkPeriod;
const int CLK_DUTY = 50; // %

int getWireInput(int dir)
{                                    // get input for normal wire, takes signals from all cells except input
  int sig = 0;
  if (dataIn[dir][CELLTYPE] >= 10) { // logic gate, memory or clock
    sig = dataIn[dir][SIGNAL_PRIMA];
  } else
    switch (dataIn[dir][CELLTYPE]) {
    case CELLTYPE_WIRE:
    case CELLTYPE_DISP:
      sig = dataIn[dir][SIGNAL_PRIMA];
      break;
    case CELLTYPE_BRIDGE:
    case CELLTYPE_H2V:
    case CELLTYPE_H2V_N:
    case CELLTYPE_V2H:
    case CELLTYPE_V2H_N:
      if (dir == LEFT || dir == RIGHT)   // take directional signal
        sig = dataIn[dir][SIGNAL_PRIMA]; // horizontal
      else
        sig = dataIn[dir][SIGNAL_SECON]; // vertical
      break;
    }
  return sig;
}

ivec2 getStrongestWireInput(int startDir, int endDir, ivec2 strongestSoFar)
{
  int signal_prim_or_sec = startDir < DOWN ? SIGNAL_PRIMA : SIGNAL_SECON;
  bool thisHasSignal = getDirection(dataIn[CENTER][signal_prim_or_sec]) != NONE;
  if (getStrength(strongestSoFar[VAL]) == 0) {
    strongestSoFar[VAL] = thisHasSignal ? getStrength(dataIn[CENTER][signal_prim_or_sec]) : 0;
    strongestSoFar[DIR] = NONE;
  }
  for (int dir = startDir; dir <= endDir; dir++) {
    int signal = getWireInput(dir);
    int strength = getStrength(signal);
    int otherDir = getDirection(signal);
    if (otherDir != NONE && otherDir != opositeDir(dir) && strength > strongestSoFar[VAL]) {
      strongestSoFar[DIR] = dir;
      strongestSoFar[VAL] = strength;
    }
  }

  if (strongestSoFar[DIR] == CENTER)
    strongestSoFar[DIR] = NONE;

  return strongestSoFar;
}

ivec2 getStrongestWireInput(int startDir, int endDir) { return getStrongestWireInput(startDir, endDir, ivec2(0)); }

int getInputInput(int dir)
{                                    // get input for input cell, takes signals from all cells except gates and inputs
  int sig = 0;
  if (dataIn[dir][CELLTYPE] >= 10) { // can not take input from logic gate, memory or clock
    sig = 0;
  } else
    switch (dataIn[dir][CELLTYPE]) {
    case CELLTYPE_WIRE:
    case CELLTYPE_DISP:
      sig = dataIn[dir][SIGNAL_PRIMA];
      break;
    case CELLTYPE_BRIDGE:
    case CELLTYPE_H2V:
    case CELLTYPE_H2V_N:
    case CELLTYPE_V2H:
    case CELLTYPE_V2H_N:
      if (dir == LEFT || dir == RIGHT)   // take directional signal
        sig = dataIn[dir][SIGNAL_PRIMA]; // horizontal
      else
        sig = dataIn[dir][SIGNAL_SECON]; // vertical
      break;
    }
  return sig;
}

void setLogicGateOutput(bool state) { dataIn[CENTER][SIGNAL_PRIMA] = packSignal(state ? CENTER : NONE, state ? MAX_SIGNAL_STRENGTH : 0); }

void main()
{
  dataIn[CENTER] = ivec4(texture(tex, texCoord));
  int cell_type = dataIn[CENTER][CELLTYPE];

  dataIn[LEFT] = ivec4(texture(tex, texCoordXmY0));
  dataIn[DOWN] = ivec4(texture(tex, texCoordX0Ym));
  dataIn[RIGHT] = ivec4(texture(tex, texCoordXpY0));
  dataIn[UP] = ivec4(texture(tex, texCoordX0Yp));

  if (cell_type >= 10 && cell_type < 30) { // logic gate or memory type
                                           // read inputs:
    int numInputs = 0, numHigh = 0;

    for (int dir = LEFT; dir <= UP; dir++) {
      if (dataIn[dir][CELLTYPE] == CELLTYPE_INPUT) {
        numInputs++;
        if (getStrength(dataIn[dir][SIGNAL_PRIMA]) > 0)
          numHigh++;
      }
    }

    if (numInputs == 0 && cell_type != CELLTYPE_MEM) { // no inputs
      dataIn[CENTER][SIGNAL_PRIMA] = 0;                // no signal
    } else
      switch (cell_type) {
      case CELLTYPE_OR:
        setLogicGateOutput(numHigh >= 1); // ≥1
        break;
      case CELLTYPE_NOR:
        setLogicGateOutput(numHigh == 0); // =0
        break;
      case CELLTYPE_AND:
        setLogicGateOutput(numHigh == numInputs && numHigh > 1); // &
        break;
      case CELLTYPE_NAND:
        setLogicGateOutput(!(numHigh == numInputs && numHigh > 1)); // &!
        break;
      case CELLTYPE_XOR:
        setLogicGateOutput(numHigh == 1); // =1
        break;
      case CELLTYPE_XNOR:
        setLogicGateOutput(numInputs > 1 && (numHigh == 0 || numHigh == numInputs)); // = a=b=c all inputs are equal
        break;
      case CELLTYPE_SUM:
        setLogicGateOutput(numHigh == 1 || numHigh == 3); // +
        break;
      case CELLTYPE_CARRY:
        setLogicGateOutput(numHigh >= 2); // ^
        break;
      case CELLTYPE_MEM: {
        bool risingEdge = false;
        for (int dir = LEFT; dir <= UP; dir++) {
          if (dataIn[dir][CELLTYPE] == CELLTYPE_CLK_INPUT && getStrength(dataIn[dir][SIGNAL_PRIMA]) > 0) {
            risingEdge = true;
          }
        }
        if (risingEdge) {
          dataIn[CENTER][SIGNAL_PRIMA] = packSignalSource(numInputs > 0 && numHigh > 0); // multiple inputs will be orred
        }
      } break;
      default:
        dataIn[CENTER][SIGNAL_PRIMA] = 0; // no signal
        dataIn[CENTER][SIGNAL_SECON] = 0;
      }
  } else {
    switch (cell_type) {
    case CELLTYPE_WIRE:
    case CELLTYPE_DISP: {
      int curDir = getDirection(dataIn[CENTER][SIGNAL_PRIMA]);
      bool thisHasSignal = curDir != NONE;
      if (curDir != IMUNE) {
        ivec2 strongestSig = getStrongestWireInput(LEFT, UP);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_PRIMA] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_PRIMA] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(NONE, 0); // open to recieve again
      }
      dataIn[CENTER][SIGNAL_SECON] = 0;                     // turn off secondary signal, not used
    } break;


    case CELLTYPE_BRIDGE: {
      // HORIZONTAL SIGNAL:
      int curDir = getDirection(dataIn[CENTER][SIGNAL_PRIMA]);
      bool thisHasSignal = curDir != NONE;
      if (curDir != IMUNE) {
        ivec2 strongestSig = getStrongestWireInput(LEFT, RIGHT);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_PRIMA] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_PRIMA] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(NONE, 0); // open to recieve again
      }

      // VERTICAL SIGNAL:
      curDir = getDirection(dataIn[CENTER][SIGNAL_SECON]);
      thisHasSignal = curDir != NONE;
      if (curDir != IMUNE) {
        ivec2 strongestSig = getStrongestWireInput(DOWN, UP);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_SECON] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_SECON] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_SECON] = packSignal(NONE, 0); // open to recieve again
      }

    } break;
    case CELLTYPE_H2V: {
      // HORIZONTAL SIGNAL:
      int curDir = getDirection(dataIn[CENTER][SIGNAL_PRIMA]);
      bool thisHasSignal = curDir != NONE;
      ivec2 strongestSig = ivec2(0);
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(LEFT, RIGHT);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_PRIMA] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_PRIMA] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(NONE, 0); // open to recieve again
      }

      // VERTICAL SIGNAL:
      curDir = getDirection(dataIn[CENTER][SIGNAL_SECON]);
      thisHasSignal = curDir != NONE;
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(DOWN, UP, strongestSig);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_SECON] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_SECON] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_SECON] = packSignal(NONE, 0); // open to recieve again
      }
    } break;
    case CELLTYPE_H2V_N: {
      // HORIZONTAL SIGNAL:
      int curDir = getDirection(dataIn[CENTER][SIGNAL_PRIMA]);
      bool thisHasSignal = curDir != NONE;
      ivec2 strongestSig = ivec2(0);
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(LEFT, RIGHT);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_PRIMA] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_PRIMA] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(NONE, 0); // open to recieve again
      }

      if (strongestSig[VAL] == 0) { // invert signal
        strongestSig[DIR] = LEFT;
        strongestSig[VAL] = MAX_SIGNAL_STRENGTH;
      } else {
        strongestSig[VAL] = 0;
        strongestSig[DIR] = NONE;
      }

      // VERTICAL SIGNAL:
      curDir = getDirection(dataIn[CENTER][SIGNAL_SECON]);
      thisHasSignal = curDir != NONE;
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(DOWN, UP, strongestSig);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_SECON] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_SECON] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_SECON] = packSignal(NONE, 0); // open to recieve again
      }
    } break;
    case CELLTYPE_V2H: {
      // VERTICAL SIGNAL:
      int curDir = getDirection(dataIn[CENTER][SIGNAL_SECON]);
      bool thisHasSignal = curDir != NONE;
      ivec2 strongestSig = ivec2(0);
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(DOWN, UP);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_SECON] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_SECON] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_SECON] = packSignal(NONE, 0); // open to recieve again
      }

      // HORIZONTAL SIGNAL:
      curDir = getDirection(dataIn[CENTER][SIGNAL_PRIMA]);
      thisHasSignal = curDir != NONE;
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(LEFT, RIGHT, strongestSig);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_PRIMA] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_PRIMA] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(NONE, 0); // open to recieve again
      }
    } break;
    case CELLTYPE_V2H_N: {
      // VERTICAL SIGNAL:
      int curDir = getDirection(dataIn[CENTER][SIGNAL_SECON]);
      bool thisHasSignal = curDir != NONE;
      ivec2 strongestSig = ivec2(0);
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(DOWN, UP);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_SECON] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_SECON] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_SECON] = packSignal(NONE, 0); // open to recieve again
      }

      if (strongestSig[VAL] == 0) { // invert signal
        strongestSig[DIR] = UP;
        strongestSig[VAL] = MAX_SIGNAL_STRENGTH;
      } else {
        strongestSig[VAL] = 0;
        strongestSig[DIR] = NONE;
      }

      // HORIZONTAL SIGNAL:
      curDir = getDirection(dataIn[CENTER][SIGNAL_PRIMA]);
      thisHasSignal = curDir != NONE;
      if (curDir != IMUNE) {
        strongestSig = getStrongestWireInput(LEFT, RIGHT, strongestSig);
        if (strongestSig[DIR] != NONE) { // new strongest signal found
          dataIn[CENTER][SIGNAL_PRIMA] = packSignal(strongestSig[DIR], strongestSig[VAL] - 1);
        } else {
          if (thisHasSignal)
            dataIn[CENTER][SIGNAL_PRIMA] = packSignal(IMUNE, 0); // lose signal and become imune for one timestep
        }
      } else {
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(NONE, 0); // open to recieve again
      }
    } break;

    case CELLTYPE_INPUT:
      if (getStrength(getInputInput(LEFT)) > 0)
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(LEFT, MAX_SIGNAL_STRENGTH);
      else if (getStrength(getInputInput(RIGHT)) > 0)
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(RIGHT, MAX_SIGNAL_STRENGTH);
      else if (getStrength(getInputInput(UP)) > 0)
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(UP, MAX_SIGNAL_STRENGTH);
      else if (getStrength(getInputInput(DOWN)) > 0)
        dataIn[CENTER][SIGNAL_PRIMA] = packSignal(DOWN, MAX_SIGNAL_STRENGTH);
      else
        dataIn[CENTER][SIGNAL_PRIMA] = 0; // set low
      break;

    case CELLTYPE_CLK_INPUT: {
      bool hasHighSignal = false;
      for (int dir = LEFT; dir <= UP; dir++) {
        if (getStrength(getInputInput(dir)) > 0)
          hasHighSignal = true;
      }
      bool prevSignal = getStrength(dataIn[CENTER][SIGNAL_SECON]) > 0;
      dataIn[CENTER][SIGNAL_PRIMA] = packSignalSource(hasHighSignal && !prevSignal); // output on rising edge
      dataIn[CENTER][SIGNAL_SECON] = packSignalSource(hasHighSignal);                // used to store previous signal
    } break;

    case CELLTYPE_CLK:
      dataIn[CENTER][SIGNAL_PRIMA] = packSignalSource(IterNum % clkPeriod > clkPeriod * (100 - CLK_DUTY) / 100);
      break;
    case CELLTYPE_CLK_2:
      dataIn[CENTER][SIGNAL_PRIMA] = packSignalSource(IterNum % (clkPeriod * 2) > clkPeriod * 2 * (100 - CLK_DUTY) / 100);
      break;
    case CELLTYPE_CLK_4:
      dataIn[CENTER][SIGNAL_PRIMA] = packSignalSource(IterNum % (clkPeriod * 4) > clkPeriod * 4 * (100 - CLK_DUTY) / 100);
      break;
    case CELLTYPE_CLK_8:
      dataIn[CENTER][SIGNAL_PRIMA] = packSignalSource(IterNum % (clkPeriod * 8) > clkPeriod * 8 * (100 - CLK_DUTY) / 100);
      break;

    case CELLTYPE_NONE:
    default:
      dataIn[CENTER][SIGNAL_PRIMA] = 0; // no signal
      dataIn[CENTER][SIGNAL_SECON] = 0; // no signal
    }
  }
  dataOut = uvec4(dataIn[CENTER]);
}