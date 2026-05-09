from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

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
    slot = db.Column(db.Integer) # Which physical compartment
    pills_count = db.Column(db.Integer, default=1) # How many pills in that slot
    taken = db.Column(db.Boolean, default=False)

# --- Routes ---

@app.route('/api/doses', methods=['GET'])
def get_doses():
    doses = Dose.query.all()
    return jsonify([{
        'id': d.id,
        'medication': d.medication,
        'dosage': d.dosage,
        'time': d.time,
        'slot': d.slot,
        'pills_count': d.pills_count,
        'taken': d.taken
    } for d in doses])

@app.route('/api/doses', methods=['POST'])
def add_dose():
    data = request.json
    new_dose = Dose(
        medication=data.get('medication'),
        dosage=data.get('dosage'),
        time=data.get('time'),
        slot=data.get('slot'),
        pills_count=data.get('pills_count', 1),
        taken=data.get('taken', False)
    )
    db.session.add(new_dose)
    db.session.commit()
    return jsonify({'message': 'Dose added successfully', 'id': new_dose.id}), 201

@app.route('/api/doses/<int:dose_id>', methods=['PATCH'])
def update_dose(dose_id):
    dose = Dose.query.get_or_404(dose_id)
    data = request.json
    if 'taken' in data:
        dose.taken = data['taken']
    db.session.commit()
    return jsonify({'message': 'Dose updated successfully'})

# Initialize data and run app
if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Create the SQLite database
    app.run(debug=True, port=5000)
