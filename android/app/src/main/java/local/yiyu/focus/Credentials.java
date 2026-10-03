package local.yiyu.focus;
import android.content.Context;
import android.security.keystore.*;
import android.util.*;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
final class Credentials {
 private final Context context;private static final String ALIAS="yiyu-focus-webdav";
 Credentials(Context c){context=c;}
 private SecretKey key()throws Exception{KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(ks.containsAlias(ALIAS))return (SecretKey)ks.getKey(ALIAS,null);KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");gen.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return gen.generateKey();}
 void save(JSONObject value)throws Exception{Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());JSONObject encrypted=new JSONObject().put("iv",Base64.encodeToString(c.getIV(),Base64.NO_WRAP)).put("cipher",Base64.encodeToString(c.doFinal(value.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP));AtomicFile f=new AtomicFile(new File(context.getFilesDir(),"sync-credentials.enc"));FileOutputStream out=null;try{out=f.startWrite();out.write(encrypted.toString().getBytes(StandardCharsets.UTF_8));f.finishWrite(out);}catch(Exception e){if(out!=null)f.failWrite(out);throw e;}}
 JSONObject load()throws Exception{File f=new File(context.getFilesDir(),"sync-credentials.enc");if(!f.exists())return null;JSONObject e=new JSONObject(StateStore.read(f,8192));Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(e.getString("iv"),Base64.NO_WRAP)));return new JSONObject(new String(c.doFinal(Base64.decode(e.getString("cipher"),Base64.NO_WRAP)),StandardCharsets.UTF_8));}
 void clear()throws Exception{File f=new File(context.getFilesDir(),"sync-credentials.enc");if(f.exists()&&!f.delete())throw new IOException("授权删除失败");}
}
