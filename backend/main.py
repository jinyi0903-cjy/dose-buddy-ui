from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import serial
from datetime import datetime, timedelta
from sqlalchemy import inspect, text

app = Flask(__name__)
CORS(app)

# Arduino Configuration
# Replace 'COM3' with your actual Arduino port (e.g., 'COM4', '/dev/ttyUSB0')
ARDUINO_PORT = 'COM3' 
try:
    arduino = serial.Serial(ARDUINO_PORT, 9600, timeout=1)
except Exception as e:
    print(f"Warning: Could not connect to Arduino on {ARDUINO_PORT}. Hardware disabled.")
    arduino = None

# Database configuration
db_path = os.path.join(os.path.dirname(__file__), 'dosebuddy_v2.db')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path # Using a NEW SQLite file
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Models ---
class Dose(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    medication = db.Column(db.String(100), nullable=False)
    dosage = db.Column(db.String(50))
    time = db.Column(db.String(50))
    scheduled_date = db.Column(db.String(10), default=lambda: datetime.now().strftime('%Y-%m-%d'))
    slot = db.Column(db.Integer) # Which physical compartment
    pills_count = db.Column(db.Integer, default=1) # How many pills in that slot
    taken = db.Column(db.Boolean, default=False)
    interval = db.Column(db.Integer, default=0) # Hours between doses
    max_doses_per_day = db.Column(db.Integer, default=1)


def today_str():
    return datetime.now().strftime('%Y-%m-%d')


def parse_dose_datetime(dose_date, dose_time):
    return datetime.strptime(f"{dose_date} {dose_time}", "%Y-%m-%d %H:%M")


def ensure_schema_columns():
    inspector = inspect(db.engine)
    columns = {column['name'] for column in inspector.get_columns('dose')}

    if 'scheduled_date' not in columns:
        db.session.execute(text('ALTER TABLE dose ADD COLUMN scheduled_date VARCHAR(10)'))
    if 'max_doses_per_day' not in columns:
        db.session.execute(text('ALTER TABLE dose ADD COLUMN max_doses_per_day INTEGER DEFAULT 1'))
    db.session.execute(text("UPDATE dose SET scheduled_date = COALESCE(scheduled_date, :today)"), {'today': today_str()})
    db.session.execute(text("UPDATE dose SET max_doses_per_day = COALESCE(max_doses_per_day, 1)"))
    db.session.commit()

# --- Routes ---

@app.route('/api/doses', methods=['GET'])
def get_doses():
    doses = Dose.query.all()
    return jsonify([{
        'id': d.id,
        'medication': d.medication,
        'dosage': d.dosage,
        'time': d.time,
        'scheduled_date': d.scheduled_date or today_str(),
        'slot': d.slot,
        'pills_count': d.pills_count,
        'taken': d.taken,
        'interval': d.interval,
        'max_doses_per_day': d.max_doses_per_day or 1
    } for d in doses])

@app.route('/api/doses', methods=['POST'])
def add_dose():
    data = request.json
    new_dose = Dose(
        medication=data.get('medication'),
        dosage=data.get('dosage'),
        time=data.get('time'),
        scheduled_date=data.get('scheduled_date', today_str()),
        slot=data.get('slot'),
        pills_count=data.get('pills_count', 1),
        taken=data.get('taken', False),
        interval=data.get('interval', 0),
        max_doses_per_day=data.get('max_doses_per_day', 1)
    )
    db.session.add(new_dose)
    db.session.commit()
    return jsonify({'message': 'Dose added successfully', 'id': new_dose.id}), 201

@app.route('/api/dispense', methods=['POST'])
def trigger_dispense():
    if arduino:
        arduino.write(b"START_DISPENSE\n")
        return jsonify({'status': 'Dispense command sent to hardware'})
    return jsonify({'error': 'Arduino not connected'}), 503

@app.route('/api/doses/<int:dose_id>', methods=['PATCH'])
def update_dose(dose_id):
    dose = Dose.query.get_or_404(dose_id)
    data = request.json
    was_taken = dose.taken
    remaining_stock = dose.pills_count or 0
    if 'taken' in data:
        dose.taken = data['taken']
    if 'pills_count' in data:
        dose.pills_count = data['pills_count']
    if data.get('taken') is True and not was_taken and data.get('decrement_stock'):
        remaining_stock = max(remaining_stock - 1, 0)
        dose.pills_count = remaining_stock

        if data.get('schedule_next') and dose.interval > 0 and remaining_stock > 0:
            current_dt = parse_dose_datetime(dose.scheduled_date or today_str(), dose.time)
            next_dt = current_dt + timedelta(hours=dose.interval)
            occurrences_today = Dose.query.filter(
                Dose.medication == dose.medication,
                Dose.slot == dose.slot,
                Dose.scheduled_date == next_dt.strftime('%Y-%m-%d'),
                Dose.interval == dose.interval,
            ).count()

            if occurrences_today < (dose.max_doses_per_day or 1):
                next_dose = Dose(
                    medication=dose.medication,
                    dosage=dose.dosage,
                    time=next_dt.strftime('%H:%M'),
                    scheduled_date=next_dt.strftime('%Y-%m-%d'),
                    slot=dose.slot,
                    pills_count=remaining_stock,
                    taken=False,
                    interval=dose.interval,
                    max_doses_per_day=dose.max_doses_per_day or 1,
                )
                db.session.add(next_dose)
    db.session.commit()
    return jsonify({'message': 'Dose updated successfully'})

@app.route('/api/doses/<int:dose_id>', methods=['DELETE'])
def delete_dose(dose_id):
    dose = Dose.query.get_or_404(dose_id)
    db.session.delete(dose)
    db.session.commit()
    return jsonify({'message': 'Dose deleted successfully'})

# Initialize data and run app
if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Create the SQLite database
        ensure_schema_columns()
    app.run(debug=True, port=5000)
