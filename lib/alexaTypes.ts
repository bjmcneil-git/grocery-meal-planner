export interface AlexaSlot {
  name: string;
  value?: string;
}

export interface AlexaIntent {
  name: string;
  slots?: Record<string, AlexaSlot>;
}

export interface AlexaRequest {
  type: "LaunchRequest" | "IntentRequest" | "SessionEndedRequest";
  requestId: string;
  timestamp: string;
  intent?: AlexaIntent;
}

export interface AlexaRequestEnvelope {
  version: string;
  request: AlexaRequest;
  context?: {
    System?: {
      application?: {
        applicationId?: string;
      };
    };
  };
}

export interface AlexaResponseEnvelope {
  version: string;
  response: {
    outputSpeech: {
      type: "PlainText";
      text: string;
    };
    shouldEndSession: boolean;
  };
}
