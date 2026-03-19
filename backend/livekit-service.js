import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

class LiveKitService {
  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY;
    this.apiSecret = process.env.LIVEKIT_API_SECRET;
    this.wsUrl = process.env.LIVEKIT_URL || 'wss://your-project.livekit.cloud';
    this.httpUrl = this.wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  }

  isConfigured() {
    return !!(this.apiKey && this.apiSecret);
  }

  /**
   * Generate an access token for a participant to join a LiveKit room.
   * Includes agent dispatch so the Mayler agent auto-joins.
   */
  async createToken(identity, roomName, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('LiveKit credentials not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.');
    }

    const {
      ttl = '6h',
      canPublish = true,
      canSubscribe = true,
      canPublishData = true,
      metadata = '',
    } = options;

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      ttl,
      metadata,
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData,
    });

    return await token.toJwt();
  }

  /**
   * Create a token with agent dispatch — when the user joins,
   * the Mayler voice agent is automatically dispatched to the room.
   */
  async createTokenWithAgentDispatch(identity, roomName, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('LiveKit credentials not configured.');
    }

    const {
      ttl = '6h',
      canPublish = true,
      canSubscribe = true,
      canPublishData = true,
      agentName = 'mayler-voice-agent',
      metadata = '',
    } = options;

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      ttl,
      metadata,
      roomConfig: {
        agents: [{ agentName }],
      },
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData,
    });

    return await token.toJwt();
  }

  /**
   * List active rooms.
   */
  async listRooms() {
    if (!this.isConfigured()) return [];
    const svc = new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret);
    return await svc.listRooms();
  }

  /**
   * Delete / close a room.
   */
  async deleteRoom(roomName) {
    if (!this.isConfigured()) return;
    const svc = new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret);
    await svc.deleteRoom(roomName);
  }
}

export default LiveKitService;
