const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo='QiWeiYouWei/yiyu-focus';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'distribution/release.json'),'utf8'));
const version=require('../package.json').version;
if(!/^\d+\.\d+\.\d+$/.test(version)||manifest.version!==version)throw Error('Release version does not match package.json');
const tag='v'+version,name=end=>'Yiyu-Focus-'+version+'-'+end;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const android=path.resolve(root,manifest.android.file),notes=path.resolve(root,manifest.notes);
if(!android.startsWith(path.join(root,'distribution')+path.sep)||!notes.startsWith(path.join(root,'docs/releases')+path.sep))throw Error('Release inputs must stay in distribution and docs/releases');
if(fs.statSync(android).size!==manifest.android.bytes||hash(android)!==manifest.android.sha256)throw Error('Original signed Android APK checksum mismatch');
const output=path.join(root,'release');fs.mkdirSync(output,{recursive:true});fs.copyFileSync(android,path.join(output,name('Android.apk')));
const files=[name('Windows.exe'),name('Android.apk')].map(f=>path.join(output,f));
for(const file of files)if(!fs.statSync(file).size)throw Error('Empty release artifact');
const checksums=files.map(file=>hash(file)+'  '+path.basename(file)).join('\n')+'\n';
const checksumFile=path.join(output,name('SHA256.txt'));fs.writeFileSync(checksumFile,checksums);files.push(checksumFile);
console.log('Prepared '+version+' downloads; signed Android APK matches the original.');
if(process.argv.includes('--prepare'))process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!==repo||!process.env.GH_TOKEN)throw Error('Publishing requires the authorized repository workflow');
const run=args=>cp.execFileSync('gh',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const lookup=()=>{const pages=JSON.parse(run(['api','--paginate','--slurp','repos/'+repo+'/releases?per_page=100']));const matches=pages.flat().filter(r=>r.tag_name===tag);if(matches.length>1)throw Error('Multiple release drafts share this tag; refusing ambiguous publication');return matches[0]||null;};
let release=lookup();
if(release&&!release.draft)throw Error('This version is already published; keep published downloads immutable and bump the version for a new release');
if(!release){run(['release','create',tag,'--repo',repo,'--target',process.env.GITHUB_SHA,'--title','一隅 Focus '+version,'--notes-file',notes,'--draft']);release=lookup();if(!release?.draft)throw Error('Draft release was not created');}
run(['release','edit',tag,'--repo',repo,'--target',process.env.GITHUB_SHA,'--notes-file',notes,'--draft=true']);
run(['release','upload',tag,...files,'--repo',repo,'--clobber']);
release=lookup();
for(const file of files){const asset=release.assets.find(a=>a.name===path.basename(file));if(!asset||asset.size!==fs.statSync(file).size)throw Error('Uploaded asset size mismatch: '+path.basename(file));if(asset.digest&&asset.digest!=='sha256:'+hash(file))throw Error('Uploaded asset checksum mismatch: '+path.basename(file));}
// Re-download draft assets so validation covers actual downloadable bytes.
const verify=fs.mkdtempSync(path.join(root,'test-results/release-download-'));
run(['release','download',tag,'--repo',repo,'--dir',verify]);
for(const file of files)if(hash(path.join(verify,path.basename(file)))!==hash(file))throw Error('Downloaded artifact differs from build: '+path.basename(file));
run(['release','edit',tag,'--repo',repo,'--draft=false','--latest']);
release=lookup();if(release.draft)throw Error('Release is still a draft');console.log('Published '+release.html_url);
