// Signal direction
#define NONE -1
#define CENTER 0
#define LEFT 1
#define DOWN 2
#define RIGHT 3
#define UP 4

/*
0 r x : celltype
1 g y : signal normal used by bridge as horizontal signal
2 b z : signal second used by bridge as vertical signal
3 a w : -

signal: -1 is low 0 or >0 is high!

celltype top layer:
0   nothing / empty
1   wire         transfers signals in all directions
2   bridge       doesn't mix horizontal and vertical signals
3   gate input   gates only read input from this

*/

// texture indexes
#define CELLTYPE 0
#define SIGNAL_PRIMA 1
#define SIGNAL_SECON 2

// userinputvalues
#define TYPE 2
#define REVERSE 3

// celltypes
#define CELLTYPE_NONE 0   // nothing / empty
#define CELLTYPE_WIRE 1   // transfers signals in all directions
#define CELLTYPE_BRIDGE 2 // doesn't mix horizontal and vertical signals
#define CELLTYPE_INPUT 3  // gate input and can set MEM to 1
#define CELLTYPE_H2V 4    // Transfers signals only from horizontal to vertical direction
#define CELLTYPE_V2H 5
#define CELLTYPE_H2V_N 6  // Transfers signals only from horizontal to vertical direction inverted
#define CELLTYPE_V2H_N 7

// Logic gates:
#define CELLTYPE_OR 10    //  >0
#define CELLTYPE_NOR 11   //  =0
#define CELLTYPE_AND 12   //  &
#define CELLTYPE_NAND 13  //  &!
#define CELLTYPE_XOR 14   //  =1
#define CELLTYPE_XNOR 15  //  !=1
#define CELLTYPE_SUM 16   //  +
#define CELLTYPE_CARRY 17 //  ≥2

// Memory types
#define CELLTYPE_MEM 20 // Set by 1 high input, reset by 2 high inputs

// Clock types
#define CELLTYPE_CLK 30   // Cells of this type all output the same clocksignal in sync
#define CELLTYPE_CLK_2 31 // 2 x longer period
#define CELLTYPE_CLK_4 32 // 4 x longer period

// Universal Functions
float map_range(float value, float min1, float max1, float min2, float max2) { return min2 + (value - min1) * (max2 - min2) / (max1 - min1); }

uint hash(uint x)
{
  x += (x << 10u);
  x ^= (x >> 6u);
  x += (x << 3u);
  x ^= (x >> 11u);
  x += (x << 15u);
  return x;
}
float random(float f)
{
  const uint mantissaMask = 0x007FFFFFu;
  const uint one = 0x3F800000u;

  uint h = hash(floatBitsToUint(f));
  h &= mantissaMask;
  h |= one;

  float r2 = uintBitsToFloat(h);
  return mod(r2 - 1.0, 1.0);
}

bool inSelection(ivec2 fragLoc, ivec4 selection)
{
  return (fragLoc.x >= selection[0] && fragLoc.x <= selection[2] && fragLoc.y >= selection[1] && fragLoc.y <= selection[3]) || (fragLoc.x >= selection[2] && fragLoc.x <= selection[0] && fragLoc.y >= selection[3] && fragLoc.y <= selection[1]) || (fragLoc.x >= selection[0] && fragLoc.x <= selection[2] && fragLoc.y >= selection[3] && fragLoc.y <= selection[1]) ||
         (fragLoc.x >= selection[2] && fragLoc.x <= selection[0] && fragLoc.y >= selection[1] && fragLoc.y <= selection[3]);
}

/*

float realMod(float a, float b)
{
    // proper modulo to handle negative numbers
    return mod(mod(a, b) + b, b);
}
*/