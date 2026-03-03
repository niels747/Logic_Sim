// Signal direction 3 bit
#define NONE 0
#define CENTER 1
#define LEFT 2
#define RIGHT 3
#define DOWN 4
#define UP 5
#define IMUNE 6                  // will not accept new signals

#define MAX_SIGNAL_STRENGTH 8191 // 2^13 - 1

/*
0 r x : celltype
1 g y : signal normal used by bridge as horizontal signal
2 b z : signal second used by bridge as vertical signal
3 a w : -

*/

// texture indexes
#define CELLTYPE 0
#define SIGNAL_PRIMA 1
#define SIGNAL_SECON 2

// SIGNAL ivec2
#define DIR 0
#define VAL 1

// userinputvalues
#define TYPE 2
#define REVERSE 3

// celltypes
#define CELLTYPE_NONE 0      // nothing / empty
#define CELLTYPE_WIRE 1      // transfers signals in all directions
#define CELLTYPE_BRIDGE 2    // doesn't mix horizontal and vertical signals
#define CELLTYPE_INPUT 3     // gate input and data input for mem
#define CELLTYPE_CLK_INPUT 4 // Clock input for MEM
#define CELLTYPE_H2V 5       // Transfers signals only from horizontal to vertical direction
#define CELLTYPE_V2H 6
#define CELLTYPE_H2V_N 7     // Transfers signals only from horizontal to vertical direction inverted
#define CELLTYPE_V2H_N 8
#define CELLTYPE_DISP 9      // same as wire, but distinctive appearance

// Logic gates:
#define CELLTYPE_OR 10    //  >0
#define CELLTYPE_NOR 11   //  =0 not gate/inverter
#define CELLTYPE_AND 12   //  &
#define CELLTYPE_NAND 13  //  &!
#define CELLTYPE_XOR 14   //  =1
#define CELLTYPE_XNOR 15  //  !=1
#define CELLTYPE_SUM 16   //  +    ( =1 | =3 )
#define CELLTYPE_CARRY 17 //  ≥2

// Memory types
#define CELLTYPE_MEM 20 // Set by 1 high input, reset by 2 high inputs

// Clock types
#define CELLTYPE_CLK 30   // Cells of this type all output the same clocksignal in sync
#define CELLTYPE_CLK_2 31 // 2 x longer period
#define CELLTYPE_CLK_4 32 // 4 x longer period
#define CELLTYPE_CLK_8 33 // 8 x longer period

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


// SIGNAL BYTE: 3 bit direction, 13 bit distance
// Pack Direction (0-7) and Distance (0-8191) into one byte
int packSignal(int dir, int strength)
{
  // dir: 0-7 (3 bits), dist: 0-8191 (13 bits)
  // We move direction to the "top" 3 bits of the 16-bit range
  return ((dir & 7) << 13) | (strength & 8191);
}

int packSignalSource(bool high) { return packSignal(high ? CENTER : NONE, high ? MAX_SIGNAL_STRENGTH : 0); }

int getDirection(int packed)
{
  // Shift right by 13 to drop the distance bits and keep the direction
  return packed >> 13;
}

int getStrength(int packed)
{
  // Mask with 8191 (binary: 0001111111111111) to get the bottom 13 bits
  return packed & 8191;
}


int opositeDir(int dir)
{
  switch (dir) {
  case LEFT:
    return RIGHT;
  case DOWN:
    return UP;
  case RIGHT:
    return LEFT;
  case UP:
    return DOWN;
  default:
    return NONE;
  }
}
/*
float realMod(float a, float b)
{
    // proper modulo to handle negative numbers
    return mod(mod(a, b) + b, b);
}
*/