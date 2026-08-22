const zlib=require('zlib'), fs=require('fs');
const W=96,H=96;
const raw=Buffer.alloc((W*4+1)*H);
let o=0;
for(let y=0;y<H;y++){ raw[o++]=0;
  for(let x=0;x<W;x++){ raw[o++]=255-(x*2)%256; raw[o++]=(y*2)%256; raw[o++]=120; raw[o++]=255; } }
function chunk(type,data){
  const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t=Buffer.from(type,'ascii'); const body=Buffer.concat([t,data]);
  const crcBuf=Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(body)>>>0);
  return Buffer.concat([len,body,crcBuf]);
}
let tbl=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0});
function crc32(b){let c=0xFFFFFFFF;for(const x of b)c=tbl[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
fs.writeFileSync('target.png', Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw)), chunk('IEND',Buffer.alloc(0))
]));
console.log('wrote target.png', fs.statSync('target.png').size);
