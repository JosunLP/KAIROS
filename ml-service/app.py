"""
KAIROS ML Service
Flask-basierter Service für Machine Learning Operationen
"""
from flask import Flask, request, jsonify
import os
import logging
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import json
from datetime import datetime
import traceback

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Konfiguration
MODEL_STORAGE_PATH = os.getenv('MODEL_STORAGE_PATH', '/app/models')
ML_SERVICE_PORT = int(os.getenv('ML_SERVICE_PORT', 8080))

# Globale Variablen für geladene Modelle
loaded_models = {}
scalers = {}

def ensure_model_directory():
    """Stellt sicher, dass das Modellverzeichnis existiert"""
    os.makedirs(MODEL_STORAGE_PATH, exist_ok=True)

def load_model(model_name):
    """Lädt ein gespeichertes Modell"""
    try:
        model_path = os.path.join(MODEL_STORAGE_PATH, f"{model_name}.joblib")
        scaler_path = os.path.join(MODEL_STORAGE_PATH, f"{model_name}_scaler.joblib")
        
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            scaler = None
            if os.path.exists(scaler_path):
                scaler = joblib.load(scaler_path)
            
            loaded_models[model_name] = model
            scalers[model_name] = scaler
            logger.info(f"Modell '{model_name}' erfolgreich geladen")
            return True
        else:
            logger.warning(f"Modell '{model_name}' nicht gefunden: {model_path}")
            return False
    except Exception as e:
        logger.error(f"Fehler beim Laden des Modells '{model_name}': {str(e)}")
        return False

def save_model(model, scaler, model_name, metadata=None):
    """Speichert ein trainiertes Modell"""
    try:
        ensure_model_directory()
        
        model_path = os.path.join(MODEL_STORAGE_PATH, f"{model_name}.joblib")
        scaler_path = os.path.join(MODEL_STORAGE_PATH, f"{model_name}_scaler.joblib")
        metadata_path = os.path.join(MODEL_STORAGE_PATH, f"{model_name}_metadata.json")
        
        joblib.dump(model, model_path)
        if scaler:
            joblib.dump(scaler, scaler_path)
        
        # Metadaten speichern
        if metadata:
            metadata['saved_at'] = datetime.now().isoformat()
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
        
        logger.info(f"Modell '{model_name}' erfolgreich gespeichert")
        return True
    except Exception as e:
        logger.error(f"Fehler beim Speichern des Modells '{model_name}': {str(e)}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health Check Endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'kairos-ml-service',
        'timestamp': datetime.now().isoformat(),
        'loaded_models': list(loaded_models.keys())
    })

@app.route('/models', methods=['GET'])
def list_models():
    """Listet alle verfügbaren Modelle auf"""
    try:
        ensure_model_directory()
        model_files = [f for f in os.listdir(MODEL_STORAGE_PATH) if f.endswith('.joblib') and not f.endswith('_scaler.joblib')]
        models = [f.replace('.joblib', '') for f in model_files]
        
        model_info = []
        for model_name in models:
            metadata_path = os.path.join(MODEL_STORAGE_PATH, f"{model_name}_metadata.json")
            metadata = {}
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
            
            model_info.append({
                'name': model_name,
                'loaded': model_name in loaded_models,
                'metadata': metadata
            })
        
        return jsonify({
            'models': model_info,
            'total': len(models)
        })
    except Exception as e:
        logger.error(f"Fehler beim Auflisten der Modelle: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/train', methods=['POST'])
def train_model():
    """Trainiert ein neues Modell"""
    try:
        data = request.get_json()
        
        if not data or 'features' not in data or 'target' not in data:
            return jsonify({'error': 'Features und Target sind erforderlich'}), 400
        
        features = np.array(data['features'])
        target = np.array(data['target'])
        model_name = data.get('model_name', 'default_model')
        
        # Daten aufteilen
        X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)
        
        # Skalierung
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Modell trainieren
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X_train_scaled, y_train)
        
        # Modell evaluieren
        train_score = model.score(X_train_scaled, y_train)
        test_score = model.score(X_test_scaled, y_test)
        
        # Metadaten erstellen
        metadata = {
            'model_type': 'RandomForestRegressor',
            'features_count': features.shape[1],
            'samples_count': features.shape[0],
            'train_score': float(train_score),
            'test_score': float(test_score),
            'trained_at': datetime.now().isoformat()
        }
        
        # Modell speichern
        if save_model(model, scaler, model_name, metadata):
            loaded_models[model_name] = model
            scalers[model_name] = scaler
            
            return jsonify({
                'message': f'Modell "{model_name}" erfolgreich trainiert',
                'metadata': metadata
            })
        else:
            return jsonify({'error': 'Fehler beim Speichern des Modells'}), 500
            
    except Exception as e:
        logger.error(f"Fehler beim Training: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Macht Vorhersagen mit einem geladenen Modell"""
    try:
        data = request.get_json()
        
        if not data or 'features' not in data or 'model_name' not in data:
            return jsonify({'error': 'Features und model_name sind erforderlich'}), 400
        
        model_name = data['model_name']
        features = np.array(data['features'])
        
        # Modell laden falls nicht bereits geladen
        if model_name not in loaded_models:
            if not load_model(model_name):
                return jsonify({'error': f'Modell "{model_name}" konnte nicht geladen werden'}), 404
        
        model = loaded_models[model_name]
        scaler = scalers.get(model_name)
        
        # Features skalieren falls Scaler vorhanden
        if scaler:
            features_scaled = scaler.transform(features.reshape(1, -1) if features.ndim == 1 else features)
        else:
            features_scaled = features
        
        # Vorhersage machen
        predictions = model.predict(features_scaled)
        
        return jsonify({
            'predictions': predictions.tolist(),
            'model_name': model_name,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Fehler bei der Vorhersage: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/load/<model_name>', methods=['POST'])
def load_model_endpoint(model_name):
    """Lädt ein spezifisches Modell"""
    try:
        if load_model(model_name):
            return jsonify({'message': f'Modell "{model_name}" erfolgreich geladen'})
        else:
            return jsonify({'error': f'Modell "{model_name}" konnte nicht geladen werden'}), 404
    except Exception as e:
        logger.error(f"Fehler beim Laden des Modells: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/unload/<model_name>', methods=['POST'])
def unload_model(model_name):
    """Entlädt ein Modell aus dem Speicher"""
    try:
        if model_name in loaded_models:
            del loaded_models[model_name]
        if model_name in scalers:
            del scalers[model_name]
        
        return jsonify({'message': f'Modell "{model_name}" erfolgreich entladen'})
    except Exception as e:
        logger.error(f"Fehler beim Entladen des Modells: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Existierende Modelle beim Start laden
    ensure_model_directory()
    logger.info("KAIROS ML Service wird gestartet...")
    logger.info(f"Modell-Speicher: {MODEL_STORAGE_PATH}")
    
    # Alle existierenden Modelle automatisch laden
    try:
        model_files = [f for f in os.listdir(MODEL_STORAGE_PATH) if f.endswith('.joblib') and not f.endswith('_scaler.joblib')]
        for model_file in model_files:
            model_name = model_file.replace('.joblib', '')
            load_model(model_name)
    except Exception as e:
        logger.warning(f"Fehler beim automatischen Laden der Modelle: {str(e)}")
    
    app.run(host='0.0.0.0', port=ML_SERVICE_PORT, debug=False)
