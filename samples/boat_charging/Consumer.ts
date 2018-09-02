import SDKFactory from '../../src/SDKFactory';
import Config from '../../src/Config';
import NeedParams from '../../src/boat-charging/NeedParams';
import BidParams from '../../src/boat-charging/BidParams';
import MissionParams from '../../src/boat-charging/MissionParams';
import MessageParams from '../../src/boat-charging/MessageParams';
import ProviderStatusMessageParams from '../../src/boat-charging/Messages/ProviderStatusMessageParams';
import StartingMessageParams from '../../src/boat-charging/Messages/StartingMessageParams';
import StatusRequestMessageParams from '../../src/boat-charging/Messages/StatusRequestMessageParams';
import VesselStatusMessageParams from '../../src/boat-charging/Messages/VesselStatusMessageParams';
import ChargingArrivalMessageParams from '../../src/boat-charging/Messages/ChargingArrivalMessageParams';
import ChargingStartedMessageParams from '../../src/boat-charging/Messages/ChargingStartedMessageParams';
import ChargingCompleteMessageParams from '../../src/boat-charging/Messages/ChargingCompleteMessageParams';
import Identity from '../../src/Identity';
import { EnergySources, Amenities } from '../../src/boat-charging/enums';
import Mission from '../../src/Mission';
import Bid from '../../src/Bid';

const printLine = () => console.log('====================================================================================================');

const sdkConfiguration = {
  apiSeedUrls: ['http://localhost'],
  kafkaSeedUrls: ['localhost:9092'],
};

export default class Consumer {
  private _privateKey: string;
  public identity: Identity;

  public async init(davId: string, privateKey: string) {
    this._privateKey = privateKey;
    const config = new Config(sdkConfiguration);
    const davSDK = SDKFactory(config);
    // try {
    //   await davSDK.registerIdentity(davId, davId, privateKey, privateKey);
    // } catch (err) {
    //   /**/
    // }
    if (await davSDK.isRegistered(davId)) {
      this.identity = await davSDK.getIdentity(davId);
    } else {
      throw new Error('Consumer: Identity is not registered');
    }
}

  public async start() {

    const need = await this.createNeed();
    const bids = await need.bids(BidParams);
    bids.subscribe(async (bid) => {
      console.log('Bid received: ', bid);
      printLine();
      const mission = await this.createMission(bid);
      this.simulateMission(mission);
    });
  }

  public async createNeed() {
    const needParams = new NeedParams({
      location: {
        lat: 32.050382,
        long: 34.766149,
      },
      startAt: 1535441613658,
      dimensions: {
        length: 1,
        width: 1,
        height: 1,
        weight: 2,
      },
      batteryCapacity: 40,
      currentBatteryCharge: 10,
      energySource: EnergySources.hydro,
      amenities: [Amenities.Park],
    });
    const need = await this.identity.publishNeed(needParams);
    return need;
  }

  public async createMission(bid: Bid<BidParams, MessageParams>) {
    const missionParams = new MissionParams({
    });
    const mission = await bid.accept(missionParams, this._privateKey);
    return mission;
  }


  public async simulateMission(mission: Mission<MissionParams>) {

    const startingMessages = await mission.messages(StartingMessageParams);
    startingMessages.subscribe(async (message) => {
      console.log('Starting message received:', message);
      printLine();

      const vesselStatusMessageParams = new VesselStatusMessageParams({
        location: {
          lat: 32.050382,
          long: 34.766149,
        },
      });
      mission.sendMessage(vesselStatusMessageParams);
      console.log('Vessel status message sent!');
      printLine();

      const startMissionTransactionReceipt = await mission.signContract(this._privateKey);
      console.log('Start mission transaction receipt:', startMissionTransactionReceipt);
      printLine();

      const chargingArrivalMessageParams = new ChargingArrivalMessageParams({});
      mission.sendMessage(chargingArrivalMessageParams);
      console.log('Charging arrival message sent!');
      printLine();

      const chargingStartedMessages = await mission.messages(ChargingStartedMessageParams);
      chargingStartedMessages.subscribe(async (chargingStartedMessage) => {
        console.log('Charging started message received:', chargingStartedMessage);
        printLine();

        const statusRequestMessageParams = new StatusRequestMessageParams({});
        mission.sendMessage(statusRequestMessageParams);
        console.log('Status request message sent!');
        printLine();
      });
    });

    const providerStatusMessages = await mission.messages(ProviderStatusMessageParams);
    providerStatusMessages.subscribe((message) => {
      console.log('Provider status message received:', message);
      printLine();
    });

    const chargingCompleteMessages = await mission.messages(ChargingCompleteMessageParams);
    chargingCompleteMessages.subscribe(async (message) => {
      console.log('Charging complete message received:', message);
      printLine();

      const finalizeMissionTransactionReceipt = await mission.finalizeMission(this._privateKey);
      console.log('Finalize mission transaction receipt: ', finalizeMissionTransactionReceipt);
      printLine();
    });

  }

}

