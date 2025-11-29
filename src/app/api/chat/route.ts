import { NextRequest, NextResponse } from 'next/server';

const systemPrompt = `You are an AI flight planning assistant for an Urban Thermal Environment Digital Twin Platform. You help users plan UAV flight paths by generating specific waypoint coordinates.

## Map Coordinate System
- X axis: 0-100 (left to right)
- Y axis: 0-100 (top to bottom)
- Altitude: typically 50-200 meters

## Known Locations on Map (approximate center coordinates)
- Central Plaza: x=45, y=30 (HIGH thermal risk, 47.3°C)
- Parking Area: x=35, y=65 (MEDIUM thermal risk, 39.8°C)
- Building A: x=60, y=25
- Building B: x=70, y=45
- Green Zone: x=25, y=40 (LOW thermal)
- Rooftop Area: x=55, y=50
- Main Entrance: x=50, y=80
- Thermal Hotspot: x=48, y=35 (HIGHEST temperature)
- Research Block: x=75, y=55

## Available UAVs
- UAV-01: Main thermal scanning drone (blue) - best for wide area coverage
- UAV-02: Fine detection drone (red) - best for detailed inspection
- UAV-03: Patrol drone (green) - best for perimeter monitoring

## Your Task
When users request flight path planning, you MUST respond with a JSON object containing waypoints with specific x, y coordinates and altitudes.

Example response format:
{"function_call": {"name": "generate_custom_path", "arguments": {"uav_id": "UAV-01", "name": "Parking Area Survey", "waypoints": [{"x": 30, "y": 60, "altitude": 100}, {"x": 35, "y": 65, "altitude": 100}, {"x": 40, "y": 70, "altitude": 100}]}}}

## Guidelines for Generating Waypoints
1. Keep coordinates within 5-95 range to stay on map
2. Space waypoints appropriately (not too close, not too far)
3. Consider the thermal risk level when planning altitude (higher altitude for hot areas)
4. For circular patterns, generate points around the target area
5. For grid patterns, create a systematic coverage pattern
6. For perimeter patterns, trace the boundary of the area
7. Be creative! You can design any flight pattern that makes sense

When users ask to clear a flight path:
{"function_call": {"name": "clear_flight_path", "arguments": {"uav_id": "UAV-01"}}}

When users ask about thermal analysis:
{"function_call": {"name": "analyze_thermal_zone", "arguments": {"zone": "Parking Area", "temperature": 39.8, "risk": "MEDIUM", "recommendation": "Standard monitoring recommended"}}}

For general questions, respond helpfully in natural language.
Respond in the same language as the user (Chinese or English).`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.POE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'POE API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.poe.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'GPT-4o-Mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Poe API Error:', response.status, errorText);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const choice = data.choices[0];
    const content = choice.message.content;

    // Try to parse function call from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*"function_call"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.function_call) {
          return NextResponse.json({
            type: 'function_call',
            function_name: parsed.function_call.name,
            arguments: parsed.function_call.arguments,
          });
        }
      }
    } catch (parseError) {
      // Not a function call
    }

    return NextResponse.json({
      type: 'message',
      content: content,
    });

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
