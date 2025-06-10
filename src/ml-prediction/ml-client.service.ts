import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface MLModelMetadata {
  model_type: string;
  features_count: number;
  samples_count: number;
  train_score: number;
  test_score: number;
  trained_at: string;
}

export interface MLModel {
  name: string;
  loaded: boolean;
  metadata: MLModelMetadata;
}

export interface TrainingData {
  features: number[][];
  target: number[];
  model_name: string;
}

export interface PredictionRequest {
  features: number[] | number[][];
  model_name: string;
}

export interface PredictionResponse {
  predictions: number[];
  model_name: string;
  timestamp: string;
}

@Injectable()
export class MLClientService {
  private readonly logger = new Logger(MLClientService.name);
  private readonly httpClient: AxiosInstance;
  private readonly mlServiceUrl: string;

  constructor(private configService: ConfigService) {
    this.mlServiceUrl = this.configService.get<string>('ML_SERVICE_URL', 'http://localhost:8080');
    
    this.httpClient = axios.create({
      baseURL: this.mlServiceUrl,
      timeout: 30000, // 30 Sekunden Timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request/Response Interceptors
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`ML Service Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('ML Service Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`ML Service Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        this.logger.error('ML Service Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Überprüft den Status des ML-Services
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await this.httpClient.get('/health');
      this.logger.debug('ML Service Health Check erfolgreich');
      return response.data;    } catch (error: any) {
      this.logger.error('ML Service Health Check fehlgeschlagen:', error.message);
      throw new HttpException(
        'ML Service nicht verfügbar',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Listet alle verfügbaren Modelle auf
   */
  async listModels(): Promise<{ models: MLModel[]; total: number }> {
    try {
      const response = await this.httpClient.get('/models');
      this.logger.debug(`${response.data.total} Modelle gefunden`);
      return response.data;    } catch (error: any) {
      this.logger.error('Fehler beim Abrufen der Modelle:', error.message);
      throw new HttpException(
        'Fehler beim Abrufen der Modelle',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Trainiert ein neues ML-Modell
   */
  async trainModel(trainingData: TrainingData): Promise<any> {
    try {
      this.logger.log(`Training Modell: ${trainingData.model_name}`);
      
      const response = await this.httpClient.post('/train', trainingData);
      
      this.logger.log(`Modell "${trainingData.model_name}" erfolgreich trainiert`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Fehler beim Training des Modells "${trainingData.model_name}":`, error.message);
      throw new HttpException(
        `Fehler beim Training des Modells: ${error.response?.data?.error || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Macht Vorhersagen mit einem trainierten Modell
   */
  async predict(predictionRequest: PredictionRequest): Promise<PredictionResponse> {
    try {
      this.logger.debug(`Vorhersage mit Modell: ${predictionRequest.model_name}`);
      
      const response = await this.httpClient.post('/predict', predictionRequest);
      
      this.logger.debug(`Vorhersage erfolgreich: ${response.data.predictions.length} Werte`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Fehler bei der Vorhersage mit Modell "${predictionRequest.model_name}":`, error.message);
      throw new HttpException(
        `Fehler bei der Vorhersage: ${error.response?.data?.error || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Lädt ein spezifisches Modell in den Speicher
   */
  async loadModel(modelName: string): Promise<any> {
    try {
      this.logger.log(`Lade Modell: ${modelName}`);
      
      const response = await this.httpClient.post(`/load/${modelName}`);
      
      this.logger.log(`Modell "${modelName}" erfolgreich geladen`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Fehler beim Laden des Modells "${modelName}":`, error.message);
      throw new HttpException(
        `Fehler beim Laden des Modells: ${error.response?.data?.error || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Entlädt ein Modell aus dem Speicher
   */
  async unloadModel(modelName: string): Promise<any> {
    try {
      this.logger.log(`Entlade Modell: ${modelName}`);
      
      const response = await this.httpClient.post(`/unload/${modelName}`);
      
      this.logger.log(`Modell "${modelName}" erfolgreich entladen`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Fehler beim Entladen des Modells "${modelName}":`, error.message);
      throw new HttpException(
        `Fehler beim Entladen des Modells: ${error.response?.data?.error || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Überprüft, ob der ML-Service verfügbar ist
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wartet darauf, dass der ML-Service verfügbar wird
   */
  async waitForService(maxWaitTime: number = 60000, interval: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        await this.healthCheck();
        this.logger.log('ML Service ist verfügbar');
        return;
      } catch (error) {
        this.logger.debug(`ML Service noch nicht verfügbar, warte ${interval}ms...`);
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    throw new HttpException(
      'ML Service ist nach dem Timeout noch nicht verfügbar',
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}
