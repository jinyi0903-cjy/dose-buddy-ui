#include <Servo.h>

// Pin Definitions
const int BLADE_SERVO_PIN = 9;  // Vertical movement servo
const int BUZZER_PIN = 8;

// Vertical Cutting Constants
const int BLADE_TOP_POSITION = 180; // Blade held at the top (safe)
const int BLADE_CUT_POSITION = 0;   // Blade pulled down straight to cut
const int CUTTING_DELAY = 1000;     // Time to allow the blade to penetrate/cut

Servo bladeServo;

void setup() {
  Serial.begin(9600);
  
  // Initialize Blade at the top position
  bladeServo.attach(BLADE_SERVO_PIN);
  bladeServo.write(BLADE_TOP_POSITION);
  
  // Initialize Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("DoseBuddy Firmware: Blade System Ready (Top Position)");
}

void loop() {
  // Listen for 'START_DISPENSE' command from UI/Backend
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "START_DISPENSE") {
      executeVerticalCut();
    }
  }
}

/**
 * Execute a straight-down vertical cutting motion
 */
void executeVerticalCut() {
  Serial.println("Action: Cutting...");
  
  // Alert user before/during cut
  digitalWrite(BUZZER_PIN, HIGH);
  
  // 1. Blade goes DOWN straight to cut
  bladeServo.write(BLADE_CUT_POSITION);
  delay(CUTTING_DELAY);
  
  // 2. Blade returns UP to the top position
  bladeServo.write(BLADE_TOP_POSITION);
  delay(500); // Allow time to return
  
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("SUCCESS: CUT_COMPLETE");
}
