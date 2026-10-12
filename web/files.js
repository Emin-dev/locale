// PNG container inspection and JPEG header inspection, before browser decoding.
// PNG framing/CRC rules: https://www.w3.org/TR/png-3/#5DataRep
// This is not a pixel decoder or an image-codec sanitizer.
const pngSignature=[137,80,78,71,13,10,26,10];
const crcTable=Uint32Array.from({length:256},(_,n)=>{
 let c=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;
});
function pngCrc(bytes,start,end){
 let crc=0xffffffff;for(let i=start;i<end;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);return(crc^0xffffffff)>>>0;
}
function pngDimensions(b){
 const d=new DataView(b.buffer,b.byteOffset,b.byteLength);
 let p=8,size,color,bitDepth,hasPalette=false,hasData=false,dataEnded=false;
 while(p<b.length){
  // Subtract before adding an untrusted uint32 length; every iteration advances
  // by at least 12 bytes and every read is contained in the supplied view.
  if(b.length-p<12)throw Error('Truncated PNG chunk.');
  const length=d.getUint32(p);
  if(length>0x7fffffff||length>b.length-p-12)throw Error('Invalid or truncated PNG chunk length.');
  const type=String.fromCharCode(...b.subarray(p+4,p+8)),end=p+8+length,next=end+4;
  if(!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type))throw Error('Invalid PNG chunk type.');
  if(type==='acTL'||type==='fcTL'||type==='fdAT')throw Error('Animated PNG screenshots are not supported. Export a static PNG or JPEG.');
  if(pngCrc(b,p+4,end)!==d.getUint32(end))throw Error('Invalid PNG chunk checksum.');
  if(!size&&type!=='IHDR')throw Error('Invalid PNG header.');
  if(type==='IHDR'){
   if(size||length!==13)throw Error('Invalid PNG header.');
   bitDepth=b[p+16];color=b[p+17];
   const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
   if(!depths[color]?.includes(bitDepth)||b[p+18]!==0||b[p+19]!==0||b[p+20]>1)throw Error('Invalid PNG header.');
   size={width:d.getUint32(p+8),height:d.getUint32(p+12),mime:'image/png'};
  }else if(type==='PLTE'){
   if(hasPalette||hasData||!length||length%3||length>768||color===0||color===4||(color===3&&length/3>2**bitDepth))throw Error('Invalid PNG palette.');
   hasPalette=true;
  }else if(type==='IDAT'){
   if(dataEnded||(color===3&&!hasPalette))throw Error('Invalid PNG image data order.');
   hasData=true;
  }else if(type==='IEND'){
   if(length!==0||!hasData||next!==b.length)throw Error('Invalid PNG end chunk.');
   return size;
  }else if(type[0]===type[0].toUpperCase())throw Error('Unsupported PNG critical chunk.');
  if(hasData&&type!=='IDAT')dataEnded=true;
  p=next;
 }
 throw Error('PNG end chunk is missing.');
}
export function imageDimensions(b){
 if(b.length>=8&&pngSignature.every((v,i)=>b[i]===v))return pngDimensions(b);
 if(b.length>=4&&b[0]===255&&b[1]===216){
  let p=2;while(p+3<b.length){if(b[p++]!==255)throw Error('Invalid JPEG marker.');while(b[p]===255)p++;const marker=b[p++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const length=(b[p]<<8)|b[p+1];if(length<2||p+length>b.length)throw Error('Truncated JPEG data.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<8)throw Error('Invalid JPEG frame.');return{width:(b[p+5]<<8)|b[p+6],height:(b[p+3]<<8)|b[p+4],mime:'image/jpeg'};}p+=length;}
 }
 throw Error('Only valid PNG and JPEG image bytes are supported.');
}
export function inspectImage(bytes){
 const size=imageDimensions(bytes);
 if(size.width<1||size.height<1||size.width>8000||size.height>8000||size.width*size.height>12000000)throw Error('Limit is 8,000 pixels per side and 12 megapixels.');
 return size;
}
