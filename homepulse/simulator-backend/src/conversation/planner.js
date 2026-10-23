'use strict';

const toolRegistry = require('../mcp/toolRegistry');

const INTENT_PATTERNS = [
  {
    pattern: /\b(search|find|look for|show|find me)\b.*\b(product|food|brand|cereal|snack|butter|milk|chips|chocolate)\b/i,
    tool: 'search_products',
    extract: extractSearchProductsArgs,
  },
  {
    pattern: /\b(compare|versus|vs\.?|which .*healthier)\b/i,
    tool: 'compare_products',
    extract: extractCompareArgs,
  },
  {
    pattern: /\b(alternative|alternatives|healthier|healthiest|lower sugar|less sugar|less salt)\b/i,
    tool: 'find_alternatives',
    extract: extractBarcodeArgs,
  },
  {
    pattern: /\b(nutrition|nutritional|calories|sugar|salt|sodium|fat|protein|allergen|allergy|peanut|ingredient|additive|vegan|vegetarian|gluten|dairy|lactose|dietary)\b/i,
    tool: selectAnalysisTool,
    extract: extractBarcodeArgs,
  },
  {
    pattern: /\b(what is|identify|tell me about|look up)\b/i,
    tool: 'search_products',
    extract: extractSearchProductsArgs,
  },
  {
    pattern: /\b\d{8,14}\b/,
    tool: 'get_product_by_barcode',
    extract: extractBarcodeArgs,
  },
];

function extractBarcodeArgs(message) {
  const match = message.match(/\b\d{8,14}\b/);
  return match ? { barcode: match[0] } : {};
}

function extractSearchProductsArgs(message) {
  const query = message
    .replace(/\b(search|find|look for|show|find me|what is|identify|tell me about|look up)\b/ig, '')
    .replace(/\b(products?|foods?)\b/ig, '')
    .replace(/[?.]/g, '')
    .trim();
  return { query: query || message.trim(), page: 1, page_size: 5 };
}

function extractCompareArgs(message) {
  const barcodes = [...message.matchAll(/\b\d{8,14}\b/g)].map(match => match[0]);
  const criteria = /sugar/i.test(message) ? 'sugar'
    : /fat/i.test(message) ? 'fat'
      : /protein/i.test(message) ? 'protein'
        : /calorie/i.test(message) ? 'calories' : 'overall';
  return { barcodes, criteria };
}

function selectAnalysisTool(message) {
  if (/allergen|allergy|peanut/i.test(message)) return 'check_allergens';
  if (/ingredient|additive|emulsifier|e-number/i.test(message)) return 'analyze_ingredients';
  if (/vegan|vegetarian|gluten|dairy|lactose|dietary/i.test(message)) return 'check_dietary_preferences';
  return 'get_nutrition_info';
}

async function plan(message, _context, tools) {
  const availableNames = new Set(tools.map(tool => tool.name));

  for (const intent of INTENT_PATTERNS) {
    if (!intent.pattern.test(message)) continue;

    const toolName = typeof intent.tool === 'function' ? intent.tool(message) : intent.tool;
    if (!availableNames.has(toolName)) continue;

    const args = intent.extract(message);
    if (['get_product_by_barcode', 'get_nutrition_info', 'check_dietary_preferences', 'check_allergens', 'analyze_ingredients', 'find_alternatives'].includes(toolName) && !args.barcode) {
      return {
        action: 'clarify',
        message: "Please include the product's barcode so I can look it up. You can also ask me to search for the product by name first.",
      };
    }
    if (toolName === 'compare_products' && args.barcodes.length < 2) {
      return {
        action: 'clarify',
        message: 'Please include at least two product barcodes so I can compare them.',
      };
    }

    return { action: 'tool_call', toolName, args, requiresConfirmation: false };
  }

  return { action: 'conversational', message: buildFallbackResponse(message, tools) };
}

function buildFallbackResponse(message, tools) {
  const toolList = tools.map(tool => `• **${tool.name}**: ${tool.description ?? ''}`).join('\n');
  return (
    `I'm not sure how to help with "${message}". ` +
    `I can search products by name, look up a barcode, analyze nutrition and ingredients, check allergens and dietary preferences, compare products, or find alternatives.\n` +
    (toolList || 'No tools are currently available.')
  );
}

module.exports = { plan };
