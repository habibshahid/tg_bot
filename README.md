# Asterisk SIP Configuration

This guide helps you set up Asterisk for SIP communication with basic configuration files. Follow the steps below to configure your SIP settings.

## SIP Configuration (`sip.conf`)

```ini
[general]
disable = yes                      ; Disable SIP (only use for PJSIP if needed)
externip = YOUR_IP                 ; Your public IP address
localnet = 192.168.1.0/24          ; Your local network (adjust the subnet accordingly)
nat = force_rport,comedia         ; Enable NAT handling

[main]
type = peer
host = YOUR_SIP_HOST              ; Your SIP provider's host
username = YOUR_SIP_USER          ; Your SIP username
secret = YOUR_SIP_PASSWORD        ; Your SIP password
fromuser = YOUR_SIP_USER          ; Username for "From" header in SIP requests
fromdomain = YOUR_SIP_HOST        ; SIP domain
context = outbound                ; Context for outbound calls
insecure = port,invite            ; Allow calls with missing port and invite headers
nat = force_rport,comedia         ; Correct handling of NAT and RTP
disallow = all                    ; Disallow all codecs
allow = ulaw                       ; Allow only ulaw codec
canreinvite = no                  ; Prevent media reinvites (important for NAT)
directmedia = no                  ; Disable direct media (important for NAT handling)
qualify = yes                     ; Enable periodic connection health checks
```

## SIP Extension (`extensions.conf`)

```ini
[general]
autofallthrough=yes            ; Automatically fall through if no match found

[outbound-coinbase]
exten => _X.,1,Answer()                           ; Answer the call
exten => _X.,n,Playback(coinbaseintro)            ; Play the intro sound
exten => _X.,n,WaitExten(10)                      ; Wait for DTMF input for 20 seconds

; If '1' is pressed
exten => 1,1,Playback(coinbaseoutro)              ; Play the outro sound
exten => 1,2,Hangup()                             ; Hang up after playing the outro sound

exten => _X.,n,Hangup()

[outbound-google]
exten => _X.,1,Answer()                           ; Answer the call
exten => _X.,n,Playback(googleintro)              ; Play the intro sound
exten => _X.,n,WaitExten(10)                      ; Wait for DTMF input for 20 seconds

; If '1' is pressed
exten => 1,1,Playback(googleoutro)                ; Play the outro sound
exten => 1,2,Hangup()                             ; Hang up after playing the outro sound

exten => _X.,n,Hangup()
```

## SIP Manager (`manager.conf`)

```ini
[general]
enabled = yes                ; Enable AMI connections (make sure this is 'yes')
port = 5038                  ; The default port for AMI (5038)
bindaddr = 0.0.0.0           ; Allow connections from any IP address (or set a specific IP)
tlsenable = no               ; Enable TLS (set to 'yes' if you want a secure connection)

[admin]                      ; This section defines a user named 'admin'
secret = YOUR_SECRET_FOR_CONNECTING        ; Set the password for the user (change to something secure)
read = all                   ; Define the privileges (e.g., read all data)
write = all                  ; Define the privileges (e.g., write all actions)
```

ALL SOUND FILES GO IN /usr/share/asterisk/sounds/

All WAV files should be mono, 8000Hz sample rate, 16 bits.

IF HAVING TROUBLE WITH ASTERISKS FILE FORMATS https://wiki.kolmisoft.com/index.php/Convert_WAV_file_to_Asterisk_playable_format
