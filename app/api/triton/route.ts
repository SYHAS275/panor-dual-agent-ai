import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

const TRITON_URL = process.env.TRITON_URL || 'http://localhost:8000';
const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

interface Detection {
  bbox: [number, number, number, number]; // x, y, width, height
  score: number;
  class: number;
  label: string;
}

interface TritonResponse {
  outputs: Array<{
    name: string;
    datatype: string;
    shape: number[];
    data: number[];
  }>;
}

// Open Images v7 classes (601 classes)
const OIV7_CLASSES = [
  "Accordion", "Adhesive tape", "Aircraft", "Airplane", "Alarm clock", "Alpaca", "Ambulance", "Animal", "Ant", "Antelope",
  "Apple", "Armadillo", "Artichoke", "Auto part", "Axe", "Backpack", "Bagel", "Baked goods", "Balance beam", "Ball",
  "Balloon", "Banana", "Band-aid", "Banjo", "Barge", "Barrel", "Baseball bat", "Baseball glove", "Bat (Animal)", "Bathroom accessory",
  "Bathroom cabinet", "Bathtub", "Beaker", "Bear", "Bed", "Bee", "Beehive", "Beer", "Beetle", "Bell pepper",
  "Belt", "Bench", "Bicycle", "Bicycle helmet", "Bicycle wheel", "Bidet", "Billboard", "Billiard table", "Binoculars", "Bird",
  "Blender", "Blue jay", "Boat", "Bomb", "Book", "Bookcase", "Boot", "Bottle", "Bottle opener", "Bow and arrow",
  "Bowl", "Bowling equipment", "Box", "Boy", "Brassiere", "Bread", "Briefcase", "Broccoli", "Bronze sculpture", "Brown bear",
  "Building", "Bull", "Burrito", "Bus", "Bust", "Butterfly", "Cabbage", "Cabinetry", "Cake", "Cake stand", "Calculator",
  "Camel", "Camera", "Can opener", "Canary", "Candle", "Candy", "Cannon", "Canoe", "Cantaloupe", "Car", "Carnivore",
  "Carrot", "Cart", "Cassette deck", "Castle", "Cat", "Cat furniture", "Caterpillar", "Cattle", "Ceiling fan", "Cello",
  "Centipede", "Chainsaw", "Chair", "Cheese", "Cheetah", "Chest of drawers", "Chicken", "Chime", "Chisel", "Chopsticks",
  "Christmas tree", "Clock", "Closet", "Clothing", "Coat", "Cocktail", "Cocktail shaker", "Coconut", "Coffee", "Coffee cup",
  "Coffee table", "Coffeemaker", "Coin", "Common fig", "Common sunflower", "Computer keyboard", "Computer monitor", "Computer mouse", "Container",
  "Convenience store", "Cookie", "Cooking spray", "Corded phone", "Cosmetics", "Couch", "Countertop", "Cowboy hat", "Crab", "Cream",
  "Cricket ball", "Crocodile", "Croissant", "Crown", "Crutch", "Cucumber", "Cupboard", "Curtain", "Cutting board", "Dagger",
  "Dairy Product", "Deer", "Desk", "Dessert", "Diaper", "Dice", "Digital clock", "Dinosaur", "Dishwasher", "Dog",
  "Dog bed", "Doll", "Dolphin", "Door", "Door handle", "Doughnut", "Dragonfly", "Drawer", "Dress", "Drill (Tool)",
  "Drink", "Drinking straw", "Drum", "Duck", "Dumbbell", "Eagle", "Earrings", "Egg (Food)", "Elephant", "Envelope",
  "Eraser", "Face powder", "Facial tissue holder", "Falcon", "Fashion accessory", "Fast food", "Fax", "Fedora", "Filing cabinet",
  "Fire hydrant", "Fireplace", "Fish", "Flag", "Flashlight", "Flower", "Flowerpot", "Flute", "Flying disc", "Food",
  "Food processor", "Football", "Football helmet", "Footwear", "Fork", "Fountain", "Fox", "French fries", "French horn",
  "Frog", "Fruit", "Frying pan", "Furniture", "Garden Asparagus", "Gas stove", "Giraffe", "Girl", "Glasses", "Glove",
  "Goat", "Goggles", "Goldfish", "Golf ball", "Golf cart", "Gondola", "Goose", "Grape", "Grapefruit", "Grinder",
  "Guacamole", "Guitar", "Hair dryer", "Hair spray", "Hamburger", "Hammer", "Hamster", "Hand dryer", "Handbag", "Handgun",
  "Harbor seal", "Harmonica", "Harp", "Harpsichord", "Hat", "Headphones", "Heater", "Hedgehog", "Helicopter", "Helmet",
  "High heels", "Hiking equipment", "Hippopotamus", "Home appliance", "Honeycomb", "Horizontal bar", "Horse", "Hot dog",
  "House", "Houseplant", "Human arm", "Human beard", "Human body", "Human ear", "Human eye", "Human face", "Human foot",
  "Human hair", "Human hand", "Human head", "Human leg", "Human mouth", "Human nose", "Humidifier", "Ice cream", "Indoor rower",
  "Infant bed", "Insect", "Invertebrate", "Ipod", "Isopod", "Jacket", "Jacuzzi", "Jaguar (Animal)", "Jeans", "Jellyfish",
  "Jet ski", "Jug", "Juice", "Kangaroo", "Kettle", "Kitchen & dining room table", "Kitchen appliance", "Kitchen knife", "Kitchen utensil", "Kitchenware",
  "Kite", "Knife", "Koala", "Ladder", "Ladle", "Ladybug", "Lamp", "Land vehicle", "Lantern", "Laptop", "Lavender (Plant)",
  "Lemon", "Leopard", "Light bulb", "Light switch", "Lighthouse", "Lily", "Limousine", "Lion", "Lipstick", "Lizard",
  "Lobster", "Loveseat", "Luggage and bags", "Lynx", "Magpie", "Mammal", "Man", "Mango", "Maple", "Maracas",
  "Marine invertebrates", "Marine mammal", "Measuring cup", "Mechanical fan", "Medical equipment", "Microphone", "Microwave oven", "Milk",
  "Miniskirt", "Mirror", "Missile", "Mixer", "Mixing bowl", "Mobile phone", "Monkey", "Moths and butterflies", "Motorcycle", "Mouse",
  "Muffin", "Mug", "Mule", "Mushroom", "Musical instrument", "Musical keyboard", "Nail (Construction)", "Necklace", "Nightstand", "Oboe",
  "Office building", "Office supplies", "Orange", "Organ (Musical Instrument)", "Ostrich", "Otter", "Oven", "Owl", "Oyster",
  "Paddle", "Palm tree", "Pancake", "Panda", "Paper cutter", "Paper towel", "Parachute", "Parking meter", "Parrot", "Pasta",
  "Pastry", "Peach", "Pear", "Pen", "Pencil case", "Pencil sharpener", "Penguin", "Perfume", "Person", "Personal care",
  "Personal flotation device", "Piano", "Picnic basket", "Picture frame", "Pig", "Pillow", "Pineapple", "Pitcher (Container)", "Pizza",
  "Pizza cutter", "Plant", "Plastic bag", "Plate", "Platter", "Plumbing fixture", "Polar bear", "Pomegranate", "Popcorn", "Porch",
  "Porcupine", "Poster", "Potato", "Power plugs and sockets", "Pressure cooker", "Pretzel", "Printer", "Pumpkin", "Punching bag",
  "Rabbit", "Raccoon", "Racket", "Radish", "Ratchet (Device)", "Raven", "Rays and skates", "Red panda", "Refrigerator", "Remote control",
  "Reptile", "Rhinoceros", "Rifle", "Ring binder", "Rocket", "Roller skates", "Rose", "Rugby ball", "Ruler", "Salad",
  "Salt and pepper shakers", "Sandal", "Sandwich", "Saucer", "Saxophone", "Scale", "Scarf", "Scissors", "Scoreboard", "Scorpion",
  "Screwdriver", "Sculpture", "Sea lion", "Sea turtle", "Seafood", "Seahorse", "Seat belt", "Segway", "Serving tray", "Sewing machine",
  "Shark", "Sheep", "Shelf", "Shellfish", "Shirt", "Shorts", "Shotgun", "Shower", "Shrimp", "Sink", "Skateboard", "Ski",
  "Skirt", "Skull", "Skunk", "Skyscraper", "Slow cooker", "Snack", "Snail", "Snake", "Snowboard", "Snowman", "Snowmobile",
  "Snowplow", "Soap dispenser", "Sock", "Sofa bed", "Sombrero", "Sparrow", "Spatula", "Spice rack", "Spider", "Spoon",
  "Sports equipment", "Sports uniform", "Squash (Plant)", "Squid", "Squirrel", "Stairs", "Stapler", "Starfish", "Stationary bicycle", "Stethoscope",
  "Stool", "Stop sign", "Strawberry", "Street light", "Stretcher", "Studio couch", "Submarine", "Submarine sandwich", "Suit", "Suitcase",
  "Sun hat", "Sunglasses", "Surfboard", "Sushi", "Swan", "Swim cap", "Swimming pool", "Swimwear", "Sword", "Syringe",
  "Table", "Table tennis racket", "Tablet computer", "Tableware", "Taco", "Tank", "Tap", "Tart", "Taxi", "Tea",
  "Teapot", "Teddy bear", "Telephone", "Television", "Tennis ball", "Tennis racket", "Tent", "Tiara", "Tick", "Tie",
  "Tiger", "Tin can", "Tire", "Toaster", "Toilet", "Toilet paper", "Tomato", "Tool", "Toothbrush", "Torch", "Tortoise",
  "Towel", "Tower", "Toy", "Traffic light", "Traffic sign", "Train", "Training bench", "Treadmill", "Tree", "Tree house",
  "Tripod", "Trombone", "Trousers", "Truck", "Trumpet", "Turkey", "Turtle", "Umbrella", "Unicycle", "Van", "Vase",
  "Vegetable", "Vehicle", "Vehicle registration plate", "Violin", "Volleyball (Ball)", "Waffle", "Waffle iron", "Wall clock", "Wardrobe",
  "Washing machine", "Waste container", "Watch", "Watercraft", "Watermelon", "Weapon", "Whale", "Wheel", "Wheelchair", "Whisk",
  "Whiteboard", "Willow", "Window", "Window blind", "Wine", "Wine glass", "Wine rack", "Winter melon", "Wok", "Woman",
  "Wood-burning stove", "Woodpecker", "Worm", "Wrench", "Zebra", "Zucchini"
];

const SUHAS_CLASSES = ["Suhas"];

// Preprocess image to model input format
function preprocessImage(imageData: number[], width: number, height: number): number[] {
  const inputSize = 640;
  const channels = 3;
  const input = new Float32Array(channels * inputSize * inputSize);

  // Simple resize and normalize to [0, 1] in CHW format
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < inputSize; y++) {
      for (let x = 0; x < inputSize; x++) {
        const srcX = Math.floor((x / inputSize) * width);
        const srcY = Math.floor((y / inputSize) * height);
        const srcIdx = (srcY * width + srcX) * 4 + c; // RGBA format
        const dstIdx = c * inputSize * inputSize + y * inputSize + x;
        input[dstIdx] = imageData[srcIdx] / 255.0;
      }
    }
  }

  return Array.from(input);
}

// Non-maximum suppression
function nms(detections: Detection[], iouThreshold: number): Detection[] {
  if (detections.length === 0) return [];

  // Sort by confidence
  detections.sort((a, b) => b.score - a.score);

  const kept: Detection[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < detections.length; i++) {
    if (suppressed.has(i)) continue;

    kept.push(detections[i]);

    for (let j = i + 1; j < detections.length; j++) {
      if (suppressed.has(j)) continue;

      const iou = calculateIoU(detections[i].bbox, detections[j].bbox);
      if (iou > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

function calculateIoU(box1: [number, number, number, number], box2: [number, number, number, number]): number {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  const left = Math.max(x1, x2);
  const top = Math.max(y1, y2);
  const right = Math.min(x1 + w1, x2 + w2);
  const bottom = Math.min(y1 + h1, y2 + h2);

  if (right <= left || bottom <= top) return 0;

  const intersection = (right - left) * (bottom - top);
  const union = w1 * h1 + w2 * h2 - intersection;

  return intersection / union;
}

// Parse YOLOv8 output
function parseYoloOutput(
  output: number[],
  shape: number[],
  classes: string[],
  imgWidth: number,
  imgHeight: number
): Detection[] {
  const detections: Detection[] = [];

  // YOLOv8 output shape: [1, numClasses + 4, numBoxes]
  // where numClasses + 4 = 4 bbox coords + class scores
  const numClasses = classes.length;
  const numBoxes = shape[2] || 8400;
  const numFeatures = shape[1] || numClasses + 4;

  for (let i = 0; i < numBoxes; i++) {
    // Get bbox coordinates (center x, center y, width, height)
    const cx = output[0 * numBoxes + i];
    const cy = output[1 * numBoxes + i];
    const w = output[2 * numBoxes + i];
    const h = output[3 * numBoxes + i];

    // Find best class
    let maxScore = 0;
    let maxClass = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = output[(4 + c) * numBoxes + i];
      if (score > maxScore) {
        maxScore = score;
        maxClass = c;
      }
    }

    if (maxScore >= CONFIDENCE_THRESHOLD) {
      // Convert from center format to corner format and scale to image size
      const scaleX = imgWidth / 640;
      const scaleY = imgHeight / 640;

      const x = (cx - w / 2) * scaleX;
      const y = (cy - h / 2) * scaleY;
      const bw = w * scaleX;
      const bh = h * scaleY;

      detections.push({
        bbox: [x, y, bw, bh],
        score: maxScore,
        class: maxClass,
        label: classes[maxClass] || `Class ${maxClass}`
      });
    }
  }

  return nms(detections, IOU_THRESHOLD);
}

async function runTritonInference(
  modelName: string,
  input: number[],
  inputShape: number[]
): Promise<TritonResponse> {
  const response = await fetch(`${TRITON_URL}/v2/models/${modelName}/infer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [
        {
          name: 'images',
          shape: inputShape,
          datatype: 'FP32',
          data: input,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Triton inference failed: ${error}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageData, width, height, model } = body;

    if (!imageData || !width || !height) {
      return NextResponse.json(
        { error: 'Missing imageData, width, or height' },
        { status: 400 }
      );
    }

    logger.info(`Triton inference request: ${width}x${height}, model: ${model || 'both'}`);

    // Preprocess image (shape includes batch dimension since max_batch_size=0)
    const input = preprocessImage(imageData, width, height);
    const inputShape = [1, 3, 640, 640]; // Explicit batch dim for non-batched models

    const allDetections: Detection[] = [];

    // Run inference on selected models
    // Note: suhas_model disabled due to ONNX opset 22 incompatibility with Triton
    // if (!model || model === 'suhas' || model === 'both') {
    //   try {
    //     const suhasResult = await runTritonInference('suhas_model', input, inputShape);
    //     const suhasOutput = suhasResult.outputs[0];
    //     const suhasDetections = parseYoloOutput(
    //       suhasOutput.data,
    //       suhasOutput.shape,
    //       SUHAS_CLASSES,
    //       width,
    //       height
    //     );
    //     allDetections.push(...suhasDetections);
    //     logger.info(`Suhas model: ${suhasDetections.length} detections`);
    //   } catch (e) {
    //     logger.warn(`Suhas model inference failed: ${e}`);
    //   }
    // }

    if (true) { // Only OIV7 model available
      try {
        const oiv7Result = await runTritonInference('yolov8n_oiv7', input, inputShape);
        const oiv7Output = oiv7Result.outputs[0];
        const oiv7Detections = parseYoloOutput(
          oiv7Output.data,
          oiv7Output.shape,
          OIV7_CLASSES,
          width,
          height
        );
        allDetections.push(...oiv7Detections);
        logger.info(`OIV7 model: ${oiv7Detections.length} detections`);
      } catch (e) {
        logger.warn(`OIV7 model inference failed: ${e}`);
      }
    }

    return NextResponse.json({
      detections: allDetections,
      count: allDetections.length,
    });
  } catch (error) {
    logger.error('Triton API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const response = await fetch(`${TRITON_URL}/v2/health/ready`);
    const ready = response.ok;

    return NextResponse.json({
      triton: ready ? 'ready' : 'not ready',
      url: TRITON_URL,
    });
  } catch {
    return NextResponse.json({
      triton: 'unreachable',
      url: TRITON_URL,
    });
  }
}
