const PARAMETER = `## Parameter Format\n
{\n
  "keywords": string[]     // Main keywords derived from query (UTF-8 string array)\n
  "searchMode": "broad" | "balanced" | "precise" // Search mode (default: "balanced")\n
  "maxTokens": number // Maximum tokens to include in response (default: 25000, min: 500, max: 50000)\n
}\n\n
### Exploration Method:\n
The allowed token range is 500 to 50000.\n

\n\n
### searchMode Usage:\n
• broad: "I want to explore what payment-related information is available"\n
• balanced: "I want to know how to integrate the payment widget"\n
• precise: "I want to know exactly what this error code means"\n
\n\n`;

export const BasePrompt = `Analyze the user's query and extract appropriate keywords and categories before making a request.\n\n
${PARAMETER}
## Example Collection\n

### case 1\n
User: I want to integrate Toss Payments payment widget\n
Assistant: { "keywords": ["payment-widget", "integration"] }\n\n

### case 2\n
User: What are the cases for card approval failure at Toss?\n
Assistant: { "keywords": ["card", "approval", "failure"] }\n\n

### case 3\n
User: What is non-authenticated payment?\n
Assistant: { "keywords": ["non-authenticated payment"] }\n\n

### case 4\n
User: How do I integrate using the SDK?\n
Assistant: { "keywords": ["sdk", "integration"] }\n\n

### case 5\n
User: Are there any policy-restricted areas?\n
Assistant: { "keywords": ["policy", "restriction"] }\n\n
`;

export const BasePromptForV1 = `Use this when the user explicitly queries for version 1.\n\n
Analyze the user's query and extract appropriate keywords before making a request. \n\n
${PARAMETER}

## Example Collection

### case 1
User: I want to integrate Toss Payments payment widget with version 1
Assistant: { "keywords": ["payment-widget", "integration"] }

### case 2
User: I'm getting an error with Toss Payments version 1 SDK
Assistant: { "keywords": ["sdk", "error"] }

### case 3
User: How do I make a card payment with payment window v1?
Assistant: { "keywords": ["card", "payment", "flow"] }
`;
