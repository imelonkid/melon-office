// Runtime geometry for the approved illustration. Coordinates are measured on the 1448x1086 plate.
// This writes metadata only: the source illustration and animation atlases remain untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'web/public/assets/layout.json');
const frames = ['sit','sit_type','sit_raise','sit_raise2','sit_blink','stand','walk1','walk2','mug','mug2','sit_phone','sit_phone2','talk1','talk2','pet1','pet2','scold1','scold2'];
const nodes = [], edges = [];
const node = (x,y) => { nodes.push([x/50,y/50]); return nodes.length-1; };
const link = (a,b) => edges.push([a,b]);
const chain = (...ids) => ids.slice(1).forEach((id,i)=>link(ids[i],id));
const entrance=node(675,995), front=node(675,860), fl=node(350,780), fr=node(958,785);
const f1=node(490,790), f2=node(726,820), f3=fr;
chain(fl,f1,front,f2,f3);link(entrance,front);
const left=node(350,610), midleft=node(365,555), m1=node(536,555), m2=node(770,555), m3=node(1005,555), right=node(1090,555);
chain(fl,left,midleft,m1,m2,m3,right);
const r1=node(1090,710), r2=node(990,770), pantry=node(1205,710);
chain(right,r1,r2,fr);link(r1,pantry);
const seatPoints=[[536,540],[770,540],[1005,540],[490,730],[726,730],[958,730]];
const seatNodes=seatPoints.map(([x,y],i)=>{const n=node(x,y);link(n,[m1,m2,m3,f1,f2,f3][i]);return n;});
const cat=node(315,730);link(cat,fl);
const c1=node(330,650),c2=node(370,680);link(c1,left);link(c2,left);
const p1=node(1230,710),p2=node(1270,735),p3=node(1170,845),p4=node(1160,700),p5=node(1270,840);
link(pantry,p1);link(p1,p2);chain(p2,p5,p3);link(pantry,p4);
// The executive leaves along the back of the table, then through its right-hand glass door.
const boss=node(273,485), b1=node(340,450),b2=node(405,490),b3=node(420,550);
chain(boss,b1,b2,b3,midleft);
const distance=nodes.map((_,i)=>nodes.map((__,j)=>i===j?0:Infinity));
const next=nodes.map((_,i)=>nodes.map((__,j)=>i===j?i:-1));
for(const [a,b] of edges){distance[a][b]=distance[b][a]=Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);next[a][b]=b;next[b][a]=a;}
for(let k=0;k<nodes.length;k++)for(let i=0;i<nodes.length;i++)for(let j=0;j<nodes.length;j++)if(distance[i][k]+distance[k][j]<distance[i][j]){distance[i][j]=distance[i][k]+distance[k][j];next[i][j]=next[i][k];}
const paths=nodes.map((_,i)=>nodes.map((__,j)=>{const route=[];let k=i;while(k!==j){k=next[k][j];if(k<0)throw new Error(`unreachable floor node ${i} -> ${j}`);route.push(k);}return route;}));
const foregrounds = [
  // Restore only the desk's front faces, never the tabletop behind the employee's face.
  {depth:541,points:[[559,510],[645,467],[644,510],[559,552]]},
  {depth:541,points:[[451,467],[559,510],[559,516],[451,474]]},
  {depth:541,points:[[795,512],[880,468],[880,512],[795,554]]},
  {depth:541,points:[[685,470],[795,512],[795,518],[685,477]]},
  {depth:541,points:[[1030,512],[1116,470],[1116,514],[1030,555]]},
  {depth:541,points:[[919,470],[1030,512],[1030,519],[919,477]]},
  {depth:731,points:[[513,696],[600,651],[600,696],[513,739]]},
  {depth:731,points:[[404,652],[513,696],[513,702],[404,659]]},
  {depth:731,points:[[748,698],[834,652],[834,698],[748,739]]},
  {depth:731,points:[[640,653],[748,698],[748,704],[640,660]]},
  {depth:731,points:[[986,699],[1070,653],[1070,699],[986,741]]},
  {depth:731,points:[[875,653],[986,699],[986,705],[875,660]]},
  {depth:486,points:[[270,547],[376,491],[376,545],[270,599]]},
];

const layout={
 characters:{boss:'boss',gua:'gua',tian:'tian',zi:'zi',agua:'agua',pi:'pi',g1:'pi',g2:'zi',g3:'agua',g4:'gua'},
 workAtlas:{columns:6,rows:2,characters:['gua','tian','zi','agua','pi','boss']},
 size:[1448,1086],iso:{ox:0,oy:0,s:50},cell:{w:104,h:156,ax:52,ay:146.64},atlas:{columns:6,rows:3},frames,
 seats:seatPoints.map(([x,y],i)=>({id:`seat-${i}`,row:i<3?'row1':'row2',x:x/50,y:y/50,anchor:[x,y-12]})),
 spots:{entrance:nodes[entrance],aisleEast:nodes[right],pantryDoor:nodes[r1],pantry:[p1,p2,p3,p4].map(i=>nodes[i]),rack:nodes[fl],cat:nodes[cat],chat:[[nodes[c1],nodes[c2]],[nodes[p2],nodes[p3]]],boss:nodes[boss],bossRoute:paths[boss][m2].map(i=>nodes[i])},
 navigation:{nodes,next},foregrounds,
 boundary:[[55,410],[725,8],[1360,410],[1360,719],[1060,873],[660,1052],[55,714]],
 wall:{clock:[618,157],banner:[0,0],projector:[0,0]},
};
const json = JSON.stringify(layout,null,2).replace(/\[\n\s+(-?[\d.]+(?:,\n\s+-?[\d.]+)*)\n\s*\]/g, (_, numbers) => '[' + numbers.replace(/\s+/g, ' ') + ']');
fs.writeFileSync(output,json+'\n');
console.log('illustrated layout written');
