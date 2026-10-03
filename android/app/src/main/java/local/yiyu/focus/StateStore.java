package local.yiyu.focus;
import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
public final class StateStore {
 private static StateStore instance;
 public static synchronized StateStore get(Context c) { if(instance==null)instance=new StateStore(c.getApplicationContext());return instance; }
 private final File folder,backups;private final AtomicFile file;private boolean failed;private long lastBackup;
 StateStore(Context c){folder=c.getFilesDir();backups=new File(folder,"backups");file=new AtomicFile(new File(folder,"focus-data.json"));}
 static String read(File f,int limit)throws Exception{try(InputStream in=new FileInputStream(f)){return text(in,limit);}}
 static String text(InputStream in,int limit)throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(out.size()+n>limit)throw new IOException("文件超过安全读取上限");out.write(buf,0,n);}return out.toString(StandardCharsets.UTF_8.name());}
 public synchronized JSONObject load()throws Exception{if(!file.getBaseFile().exists()&&!new File(file.getBaseFile()+".bak").exists())return null;try(InputStream in=file.openRead()){JSONObject state=new JSONObject(text(in,20*1024*1024));validate(state);return state;}catch(Exception e){failed=true;throw new IOException("本机记录无法读取，原文件已保留。请在偏好中恢复备份。",e);}}
 static void validate(JSONObject s)throws Exception{if(s.optInt("version")!=1||!(s.opt("profile") instanceof JSONObject))throw new IOException("备份格式无效");for(String k:new String[]{"tasks","sessions","thoughts"})if(!(s.opt(k) instanceof JSONArray))throw new IOException("备份缺少记录");}
 private void write(JSONObject state)throws Exception{byte[] bytes=state.toString().getBytes(StandardCharsets.UTF_8);if(bytes.length>20*1024*1024)throw new IOException("本机数据超过安全保存上限");FileOutputStream stream=null;try{stream=file.startWrite();stream.write(bytes);file.finishWrite(stream);}catch(Exception e){if(stream!=null)file.failWrite(stream);throw e;}}
 public synchronized void save(JSONObject state)throws Exception{validate(state);if(failed)throw new IOException("已停止写入以保护原文件，请先恢复备份");if(System.currentTimeMillis()-lastBackup>=1800000){JSONObject old=load();snapshot(old==null?state:old,"自动备份");}write(state);}
 public synchronized String snapshot(JSONObject state,String reason)throws Exception{validate(state);if(!backups.exists()&&!backups.mkdirs())throw new IOException("备份目录无法创建");JSONObject paused=new JSONObject(state.toString());JSONObject a=paused.optJSONObject("active");if(a!=null)a.put("running",false);long now=System.currentTimeMillis();String id=now+"-"+UUID.randomUUID();JSONObject b=new JSONObject().put("created",now).put("reason",reason).put("data",paused);AtomicFile f=new AtomicFile(new File(backups,id+".json"));FileOutputStream out=null;try{out=f.startWrite();out.write(b.toString().getBytes(StandardCharsets.UTF_8));f.finishWrite(out);}catch(Exception e){if(out!=null)f.failWrite(out);throw e;}lastBackup=now;File[] names=backupFiles();for(int i=30;i<names.length;i++)if(!names[i].delete())throw new IOException("旧备份无法整理");return id;}
 private File[] backupFiles(){File[] list=backups.listFiles((d,n)->n.matches("[0-9]+-[a-f0-9-]{36}\\.json"));if(list==null)return new File[0];Arrays.sort(list,(a,b)->b.getName().compareTo(a.getName()));return list;}
 public synchronized JSONArray list()throws Exception{JSONArray result=new JSONArray();for(File f:backupFiles()){JSONObject row=new JSONObject().put("id",f.getName().replace(".json",""));try{JSONObject b=new JSONObject(read(f,20*1024*1024)),s=b.getJSONObject("data");validate(s);row.put("created",b.getLong("created")).put("reason",b.getString("reason")).put("sessions",s.getJSONArray("sessions").length()).put("tasks",s.getJSONArray("tasks").length());}catch(Exception e){row.put("invalid",true);}result.put(row);}return result;}
 public synchronized JSONObject backup(String id)throws Exception{if(id==null||!id.matches("[0-9]+-[a-f0-9-]{36}"))throw new IOException("备份标识无效");JSONObject s=new JSONObject(read(new File(backups,id+".json"),20*1024*1024)).getJSONObject("data");validate(s);return s;}
 public synchronized void restore(JSONObject s)throws Exception{validate(s);try{JSONObject old=load();if(old!=null)snapshot(old,"恢复前保护");}catch(Exception e){File original=file.getBaseFile();if(original.exists())try(InputStream in=new FileInputStream(original);OutputStream out=new FileOutputStream(new File(folder,"focus-data-corrupt-"+System.currentTimeMillis()+".json"))){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);}}write(s);failed=false;snapshot(s,"恢复后备份");}
}
