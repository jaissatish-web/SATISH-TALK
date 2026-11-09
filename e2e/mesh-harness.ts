// Test-only page, excluded from the production entry point and build.
import {RadioMesh} from '../src/lib/radio/mesh';
const meshes:RadioMesh[]=[];
const states:Record<string, string>[]=[];
let sequence=0;
let context:AudioContext;
const tracks:MediaStreamTrack[]=[];
async function start(count:number){
 context=new AudioContext();await context.resume();
 for(let i=0;i<count;i++){
  const oscillator=context.createOscillator();oscillator.frequency.value=440;
  const destination=context.createMediaStreamDestination();oscillator.connect(destination);oscillator.start();
  const track=destination.stream.getAudioTracks()[0];track.enabled=false;tracks.push(track);
  meshes.push(new RadioMesh({sessionId:`member${i}`,localStream:destination.stream,localTrack:track,onPeerStates:s=>{states[i]=s;},sendSignal:async(to,kind,payload)=>{meshes[Number(to.slice(6))].handleSignal({id:String(sequence++),fromSession:`member${i}`,channel:'test',kind,payload});}}));
 }
 const ids=meshes.map((_,i)=>`member${i}`);meshes.forEach(m=>m.syncPeers(ids));
}
async function stats(){
 const result=[];
 for(const mesh of meshes){
  // Inspect private engine peer stats only in this test harness.
  const peers=(mesh as unknown as {peers:Map<string,{pc:RTCPeerConnection}>}).peers;
  let bytes=0,energy=0,packets=0;
  for(const {pc} of peers.values())for(const entry of (await pc.getStats()).values()){
   if(entry.type==='inbound-rtp'&&entry.kind==='audio'){bytes+=entry.bytesReceived??0;energy+=entry.totalAudioEnergy??0;packets+=entry.packetsReceived??0;}
  }
  result.push({bytes,energy,packets});
 }
 return result;
}
Object.assign(window,{meshTest:{start,states,stats,talk(){meshes.forEach(m=>m.setSpeaker('member0'));tracks[0].enabled=true;},stop(){tracks[0].enabled=false;meshes.forEach(m=>m.setSpeaker(null));},cleanup(){meshes.forEach(m=>m.destroy());tracks.forEach(t=>t.stop());void context.close();}}});
