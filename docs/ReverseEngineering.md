# Edilkamin Stove Reverse Engineering

Edilkamin pellet stoves remote control reverse engineering.
This is documenting my journey to reverse engineering [The Mind Edilkamin app](https://play.google.com/store/apps/details?id=com.edilkamin.stufe).
The goal was to be able to control the stove wirelessly without having to use the proprietary app.

## APK download & decompiling
The steps to decompile an APK are mainly described in this article:
[Reverse Engineering Sodexo's API](https://medium.com/@andre.miras/reverse-engineering-sodexos-api-d13710b7bf0d)

Here we summarize some of them.

- APK used: https://play.google.com/store/apps/details?id=com.edilkamin.stufe
- version: 1.2.3 (19 November 2021)

Assuming the APK is already loaded on the Android device, proceed as below to download on the computer.
Get the APK on device path:

```sh
adb shell pm list packages -f | grep edilkamin
```
Output:
```
package:/data/app/com.edilkamin.stufe-Di57pxUTs3wzjQF0dIxeEQ==/base.apk=com.edilkamin.stufe
```
Copy to the computer:
```sh
adb shell cp /data/app/com.edilkamin.stufe-Di57pxUTs3wzjQF0dIxeEQ==/base.apk /sdcard/
adb pull /sdcard/base.apk .
```
Decompile (jadx v1.3.3):
```sh
jadx --output-dir base base.apk
```

## Looking into `strings.xml`
Often an interesting starting point point is the `base/resources/res/values/strings.xml` file.
We find the usual `google_api_key` and `google_app_id`, but no endpoint prefix or anything that
will be used in the short terms.

## Let's `grep` through the source
The APK source contains a lot of thirdparty code, but the actual application code is located in:
`base/sources/com/edilkamin/stufe/`

Let's `grep` into it looking for some endpoints:
```sh
cd base/sources/com/edilkamin/stufe/ && grep -irE 'http(s)://' .
```
Output extract:
```
./network/EdilkaminApiServiceKt.java:    public static final String BASE_URL = "https://s5zsjtooy4.execute-api.eu-central-1.amazonaws.com/test/";
./network/EdilkaminApiServiceKt.java:    public static final String PROD_URL = "https://fxtj7xkgc6.execute-api.eu-central-1.amazonaws.com/prod/";
```
Other interesting files found and their extract:
- `base/sources/com/edilkamin/stufe/network/ApiService.java`:
```java
@PUT("device/{mac_address}")
Object editAssociation(@Header("Authorization") String str, @Path("mac_address") String str2, @Body EditDeviceAssociationBody editDeviceAssociationBody, Continuation<Object> continuation);

@GET("device/{macAddress}/info")
Object getFireplaceInfo(@Path("macAddress") String str, Continuation<? super GeneralResponse> continuation);
```
- `base/resources/res/raw/amplifyconfiguration.json`:
```json
"Default": {
  "PoolId": "eu-central-1_BYmQ2VBlo",
  "AppClientId": "7sc1qltkqobo3ddqsk4542dg2h",
  "Region": "eu-central-1"
}
```

## Poking the /prod/ endpoint around
```sh
curl https://fxtj7xkgc6.execute-api.eu-central-1.amazonaws.com/prod/
```
Output (status code 403):
```json
{"message":"Missing Authentication Token"}
```
Let's try an unauthenticated endpoint then, remember that file `network/ApiService.java`.
```sh
curl --verbose https://fxtj7xkgc6.execute-api.eu-central-1.amazonaws.com/prod/device/AA:BB:CC:DD:EE:FF/info
```
Output (status code 404):
```json
{}
```
That looks already promising.
After poking that endpoint around and using the real device MAC address we get a valid response.
Note how the MAC address is all lower case and no column:
```sh
curl --verbose https://fxtj7xkgc6.execute-api.eu-central-1.amazonaws.com/prod/device/aabbccddeeff/info
```
Output (status code 200):
```json
{"mac_address":"aabbccddeeff","pk":1,"component_info":{"temp_umidity_voc_probe_3":...}}
```
Bingo!

## Turn the stove on
```sh
curl --verbose --request PUT --header "Content-Type: application/json" \
--data '{"mac_address":"aabbccddeeff", "name": "power", "value": 1}' \
https://fxtj7xkgc6.execute-api.eu-central-1.amazonaws.com/prod/mqtt/command
```

## Note on Security
It seems like most endpoints let you read info or control the stove without any authentication.
All we need is a valid device MAC address.
Don't leak your MAC address or people can potentially control your stove.
