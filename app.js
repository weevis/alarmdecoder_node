const ser2sock_host = 'alarmdecoder.local';
const ser2sock_port = 10000;

const readline = require('readline');
const var net = require('net');
const var http = require('http');
const emitter = require('events');

class ADEmitter extends emitter {

}

const myEmitter = new ADEmitter();

myEmitter.on('failed_message', () => {
    console.log('Bad Message');
});

myEmitter.on('zone_fault', function(zone_id) {
    console.log('Zone faulted: ' + zone_id);
});

myEmitter.on('alarm_soudning', function(zone_id) {
    console.log('Alarm Sounding - Zone: ' + zone_id);
});

myEmitter.on('armed', function(stay_status, perimiter_status) {
    if( stay_status )
        console.log("Armed Stay " +  perimeter_status ? "Perimeter" : '');
    else
        console.log("Armed Away");
});

myEmitter.on('disarmed', function() {
    console.log("Alarm Disarmed");
});

myEmitter.on('fire', function() {
    console.log("FIRE!");
});

myEmitter.on('fire_restored', function() {
    console.log("Fire Restored!");
});

var client = new net.Socket();

class BaseMessage {
    constructor(data=null) {
        this.raw = data;
        console.log(this.raw);
        var d = new Date();
        this.timestamp = d.toLocaleString();
    }
}

class PanelMessage extends BaseMessage {
    constructor(data=null) {
        super(data);
        this.raw;
        this.timestamp;
        this.alpha = null;
        this.bit_field = null;
        this.numeric_code = null;
        this.data_field = null;

        //bitfield mappings
        this.ready = false;
        this.armed_away = false;
        this.armed_home = false;
        this.backlight_on = false;
        this.programming_mode = false;
        this.beeps = -1;
        this.zone_bypassed = false;
        this.ac_power = false;
        this.chime_on = false;
        this.alarm_event_occurred = false;
        this.alarm_sounding = false;
        this.battery_low = false;
        this.entry_delay_off = false;
        this.fire_alarm = false;
        this.check_zone = false;
        this.perimeter_only = false;
        this.system_fault = false;
        this.panel_type = 'A';
        this.cursor_location = -1;
        this.mask = 0xFFFFFFFF;
        this.old_status = false;
        this.arm_status = false;
        this.fire_status = false;
    }

    parseMessage() {
        var i = 0;
        console.log('parsing message');
        if( this.raw.length < 96 )
        {
            myEmitter.emit('failed_message');
        }        
        else
        {
            var sections = this.raw.split(",");
            this.bit_field = sections[0];
            this.numeric_code = sections[1];
            this.data_field = sections[2];
            this.alpha = sections[3];
            this.parseBitfield();

            if( this.check_zone )
                myEmitter.emit('zone_fault', this.numeric_code);

            if( this.alarm_soudning )
                myEmitter.emit('alarm_sounding', this.numeric_code);

            var arm_status = this.armed_away;
            var stay_status = this.armed_home;
            var perimeter_status = this.perimeter_only;

            if( arm_status || stay_status || perimeter_status )
            {
                myEmitter.emit('armed', stay_status, perimeter_status);
            }
            else
            {
                myEmitter.emit('disarmed');
            }
            var old_fire_status = this.fire_status;

            if( this.fire_alarm )
            {
                this.fire_status = this.fire_alarm;
                if( this.old_fire_status !== this.fire_alarm )
                {
                    myEmitter.emit('fire');
                    this.old_fire_status = this.fire_alarm;
                }
            }
            if( this.fire_status )
            {
                if( !this.fire_alarm )
                {
                    myEmitter.emit('fire_restored');
                    this.fire_status = false;
                }
            }
            console.log('endparse');
        }
    }
    
    isBitSet(bit) {
        if( bit === '1' )
            return true;
        return false;
    }
    parseBitfield() {
        this.ready = this.isBitSet(this.bit_field[1]);
        this.armed_away = this.isBitSet(this.bit_field[2]);
        this.armed_home = this.isBitSet(this.bit_field[3]);
        this.backlight_on = this.isBitSet(this.bit_field[4]);
        this.programming_mode = this.isBitSet(this.bit_field[5]);
        this.beeps = parseInt(this.bit_field[6], 16);
        this.zone_bypassed = this.isBitSet(this.bit_field[7]);
        this.ac_power = this.isBitSet(this.bit_field[8]);
        this.chime_on = this.isBitSet(this.bit_field[9]);
        this.alarm_event_occurred = this.isBitSet(this.bit_field[10]);
        this.alarm_sounding = this.isBitSet(this.bit_field[11]);
        this.battery_low = this.isBitSet(this.bit_field[12]);
        this.entry_delay_off = this.isBitSet(this.bit_field[13]);
        this.fire_alarm = this.isBitSet(this.bit_field[14]);
        this.check_zone = this.isBitSet(this.bit_field[15]);
        this.perimeter_only = this.isBitSet(this.bit_field[16]);
        this.system_fault = this.isBitSet(this.bit_field[17]);
        this.panel_type = this.bit_field[18];

        var i = 19;
        var cursor_check = '';
        for(i = 19; i < 21; i++ )
            cursor_check = cursor_check + this.bit_field[i];

        if( parseInt(cursor_check, 16) > 0 )
        {
            cursor_check = '';
            for( i = 21; i < 23; i++)
                cursor_check = cursor_check + this.bit_field[i];

            this.cursor_location = parseInt(cursor_check, 16);
        }

        var address_mask = '';
        for( i = 3; i < 11; i++)
        {
            address_mask = address_mask + this.data_field[i];
        }

        this.mask = parseInt(address_mask, 16);
    }
}


client.connect(ser2sock_port, ser2sock_host, function() {
    console.log('Connected');
});

client.on('data', function(data) {
    var message = data.toString();
    if( message.startsWith('[')) {
        var pmessage = new PanelMessage(message);
        pmessage.parseMessage();
    }
});


client.on('close', function() {
    console.log('Connection closed');
});

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
    if( key.ctrl && key.name === 'c') {
        client.destroy();
        process.exit();
    }
    else
        client.write(str);
        client.end();
});