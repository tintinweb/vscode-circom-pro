pragma circom 2.0.1;

/*This circuit template checks that c is the multiplication of a and b.*/  

template Multiplier2 () {  

   // Declaration of signals.     
   signal input a;  
   signal input b;   
   signal output c;       
   signal output f;    
   // Constraints.    
   c <-- a * b; 
   c <== a*b;    
   a * b === c;        
}             
    
   
component main = Multiplier2();   
/* 
proof.input =  { 
   "a":-5,
   "b":23
   }
*/
