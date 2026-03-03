# Logic sim
This project aims to provide a high-performance, visually immersive simulation of digital logic. From fundamental logic gates to complex computer architectures, the simulator leverages WebGL to deliver a seamless, interactive experience directly in the browser.

<br/><br/>

A simple 8 bit computer I build with my limited knowledge of cpu architecture. It has only a 4 bit adress bus wich perfectly fits the 16 Byte RAM. The instructions are also just 4 bits, which conveniently allows attaching an address to an instruction within a single byte.
<img width="2276" height="1408" alt="image" src="https://github.com/user-attachments/assets/35b676ac-5444-4759-a5c6-9f50df90e671" />



It works using a grid based system where signals can only propagate 1 cell per timestep.
Basic wire cells propagate signals in all 4 directions, while bridge cells allow vertical and horizontal signals to remain seperate.
![image](https://github.com/niels747/Logic_Sim/assets/42830240/81da2360-6d3d-496f-b335-12d81e893a22)


Logic gates with 1, 2 or 3 iputs can be used
![image](https://github.com/niels747/Logic_Sim/assets/42830240/c7cd785f-6fac-49c2-a504-25ebefab7aea)

A 4-bit full adder using compact sum and carry gates, calculating 6 + 3 = 9

![image](https://github.com/niels747/Logic_Sim/assets/42830240/6e735141-0463-4e4c-ad23-fb932673d796)


Compact vertical horizontal interconnects can be used to create compact decoders, such as BCD and 7 segment decoders
![image](https://github.com/niels747/Logic_Sim/assets/42830240/97239209-7871-406f-9691-6b7d3a5fa620)


#GUI

The custom gui used in this project is also being developed simultaneously.
Eventually this gui could also replace dat.gui in 2D_weather_sandbox.

![image](https://github.com/niels747/Logic_Sim/assets/42830240/44e637a7-eb03-457b-b589-67ba0acb8473)

