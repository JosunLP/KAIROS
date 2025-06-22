import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PredictionResult, TrainingStatus } from '../common/types';

export interface TrainingData {
  features: number[][];
  labels: number[];
  metadata?: {
    ticker: string;
    dateRange: { start: Date; end: Date };
    featureNames: string[];
  };
}

export interface PredictionRequest {
  ticker: string;
  features: number[];
  modelName?: string;
  horizon?: number;
}

export interface ModelInfo {
  name: string;
  version: string;
  accuracy: number;
  lastUpdated: Date;
  status: 'active' | 'training' | 'inactive';
  features: string[];
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  earlyStoppingPatience: number;
}

@Injectable()
export class MLClientService {
  private readonly logger = new Logger(MLClientService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8080',
    );
    this.timeout = this.configService.get<number>('ML_TIMEOUT', 30000);

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor für Logging
    this.httpClient.interceptors.request.use(
      config => {
        this.logger.debug(
          `ML Service Request: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      error => {
        this.logger.error('ML Service Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor für Logging
    this.httpClient.interceptors.response.use(
      response => {
        this.logger.debug(
          `ML Service Response: ${response.status} ${response.config.url}`,
        );
        return response;
      },
      error => {
        this.logger.error(
          'ML Service Response Error:',
          error.response?.data || error.message,
        );
        return Promise.reject(error);
      },
    );
  }

  /**
   * Prüft den Status des ML-Services
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const response = await this.httpClient.get('/health');
      return {
        healthy: response.status === 200,
        message: 'ML Service is healthy',
        details: response.data,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `ML Service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      };
    }
  }

  /**
   * Holt verfügbare Modelle
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.httpClient.get('/models');
      return response.data.models || [];
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der Modelle:', error);
      throw new Error(
        `Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Trainiert ein neues Modell
   */
  async trainModel(
    ticker: string,
    trainingData: TrainingData,
    config?: TrainingConfig,
  ): Promise<{ modelId: string; status: string }> {
    try {
      const requestBody = {
        ticker,
        trainingData,
        config: config || this.getDefaultTrainingConfig(),
      };

      const response = await this.httpClient.post('/train', requestBody);
      return {
        modelId: response.data.modelId,
        status: response.data.status,
      };
    } catch (error) {
      this.logger.error(
        `Fehler beim Training des Modells für ${ticker}:`,
        error,
      );
      throw new Error(
        `Training failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Holt den Trainingsstatus
   */
  async getTrainingStatus(modelId: string): Promise<TrainingStatus> {
    try {
      const response = await this.httpClient.get(`/training/${modelId}/status`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen des Trainingsstatus für ${modelId}:`,
        error,
      );
      throw new Error(
        `Failed to get training status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Stoppt das Training
   */
  async stopTraining(modelId: string): Promise<boolean> {
    try {
      const response = await this.httpClient.post(`/training/${modelId}/stop`);
      return response.data.success || false;
    } catch (error) {
      this.logger.error(
        `Fehler beim Stoppen des Trainings für ${modelId}:`,
        error,
      );
      throw new Error(
        `Failed to stop training: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Erstellt eine Vorhersage
   */
  async predict(request: PredictionRequest): Promise<PredictionResult> {
    try {
      const response = await this.httpClient.post('/predict', request);
      const data = response.data;

      return {
        symbol: request.ticker,
        prediction: data.prediction,
        confidence: data.confidence,
        timestamp: new Date(data.timestamp),
        model: data.modelName || 'default',
        features: data.features || {},
      };
    } catch (error) {
      this.logger.error(
        `Fehler bei der Vorhersage für ${request.ticker}:`,
        error,
      );
      throw new Error(
        `Prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Batch-Vorhersagen für mehrere Ticker
   */
  async batchPredict(
    requests: PredictionRequest[],
  ): Promise<PredictionResult[]> {
    try {
      const response = await this.httpClient.post('/predict/batch', {
        requests,
      });
      return response.data.predictions.map((pred: any) => ({
        symbol: pred.symbol,
        prediction: pred.prediction,
        confidence: pred.confidence,
        timestamp: new Date(pred.timestamp),
        model: pred.modelName || 'default',
        features: pred.features || {},
      }));
    } catch (error) {
      this.logger.error('Fehler bei Batch-Vorhersagen:', error);
      throw new Error(
        `Batch prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validiert ein Modell
   */
  async validateModel(
    modelId: string,
    testData: TrainingData,
  ): Promise<{ accuracy: number; metrics: Record<string, number> }> {
    try {
      const response = await this.httpClient.post(
        `/models/${modelId}/validate`,
        {
          testData,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Fehler bei der Modellvalidierung für ${modelId}:`,
        error,
      );
      throw new Error(
        `Model validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Löscht ein Modell
   */
  async deleteModel(modelId: string): Promise<boolean> {
    try {
      const response = await this.httpClient.delete(`/models/${modelId}`);
      return response.data.success || false;
    } catch (error) {
      this.logger.error(`Fehler beim Löschen des Modells ${modelId}:`, error);
      throw new Error(
        `Model deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Holt Modell-Metriken
   */
  async getModelMetrics(modelId: string): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: number[][];
  }> {
    try {
      const response = await this.httpClient.get(`/models/${modelId}/metrics`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen der Modell-Metriken für ${modelId}:`,
        error,
      );
      throw new Error(
        `Failed to get model metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Holt Feature-Importance
   */
  async getFeatureImportance(modelId: string): Promise<Record<string, number>> {
    try {
      const response = await this.httpClient.get(
        `/models/${modelId}/features/importance`,
      );
      return response.data.featureImportance || {};
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen der Feature-Importance für ${modelId}:`,
        error,
      );
      throw new Error(
        `Failed to get feature importance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Aktualisiert ein Modell
   */
  async updateModel(
    modelId: string,
    updateData: Partial<ModelInfo>,
  ): Promise<boolean> {
    try {
      const response = await this.httpClient.patch(
        `/models/${modelId}`,
        updateData,
      );
      return response.data.success || false;
    } catch (error) {
      this.logger.error(
        `Fehler beim Aktualisieren des Modells ${modelId}:`,
        error,
      );
      throw new Error(
        `Model update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Holt System-Metriken des ML-Services
   */
  async getSystemMetrics(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage?: number;
    activeModels: number;
    queueLength: number;
  }> {
    try {
      const response = await this.httpClient.get('/metrics/system');
      return response.data;
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der System-Metriken:', error);
      throw new Error(
        `Failed to get system metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Holt Performance-Metriken
   */
  async getPerformanceMetrics(): Promise<{
    averagePredictionTime: number;
    totalPredictions: number;
    successRate: number;
    errorRate: number;
  }> {
    try {
      const response = await this.httpClient.get('/metrics/performance');
      return response.data;
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der Performance-Metriken:', error);
      throw new Error(
        `Failed to get performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Standard-Training-Konfiguration
   */
  private getDefaultTrainingConfig(): TrainingConfig {
    return {
      epochs: 100,
      batchSize: 32,
      learningRate: 0.001,
      validationSplit: 0.2,
      earlyStoppingPatience: 10,
    };
  }

  /**
   * Testet die Verbindung zum ML-Service
   */
  async testConnection(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.healthy;
    } catch (error) {
      this.logger.error('ML Service connection test failed:', error);
      return false;
    }
  }

  /**
   * Holt verfügbare Features
   */
  async getAvailableFeatures(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/features');
      return response.data.features || [];
    } catch (error) {
      this.logger.error('Fehler beim Abrufen der verfügbaren Features:', error);
      return [];
    }
  }

  /**
   * Holt Feature-Statistiken
   */
  async getFeatureStatistics(ticker: string): Promise<Record<string, any>> {
    try {
      const response = await this.httpClient.get(
        `/features/${ticker}/statistics`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Fehler beim Abrufen der Feature-Statistiken für ${ticker}:`,
        error,
      );
      throw new Error(
        `Failed to get feature statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Prüft ob der ML-Service verfügbar ist
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const health = await this.checkHealth();
      return health.healthy;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wartet auf die Verfügbarkeit des ML-Services
   */
  async waitForService(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000; // 1 second

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isServiceAvailable()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error('ML Service did not become available within timeout');
  }

  /**
   * Holt alle verfügbaren Modelle
   */
  async listModels(): Promise<ModelInfo[]> {
    return this.getModels();
  }

  /**
   * Führt einen Health Check durch
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    details?: any;
  }> {
    return this.checkHealth();
  }
}
