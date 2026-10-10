// Header inspection only. The browser must still decode the bounded image.
export function imageDimensions(b){
 if(b.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)){
  if(String.fromCharCode(...b.slice(12,16))!=='IHDR')throw Error('Invalid PNG header.');const d=new DataView(b.buffer,b.byteOffset,b.byteLength);return{width:d.getUint32(16),height:d.getUint32(20),mime:'image/png'};
 }
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
