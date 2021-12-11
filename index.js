const discord = require('discord.js');
const { spawn } = require('child_process');
const bot = new discord.Client({ intents: [ discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES ] });
const stripAnsi = (...args) => import('strip-ansi').then(({default: stripAnsi}) => stripAnsi(...args));
const fs = require('fs');
const { Schematic } = require('mindustry-schematic-parser');

const config = require('./config.json');

let serverOnline = false;
let serverStarted = false;
let paused = false;
let players = 0;
let currentHost;
let server = spawn('java', ['-jar', 'server/server.jar'], { encoding: 'buffer' });
let logMessage;

server.stdout.on('data', (data) => {
    let messageSplit1 = data.toString().split(' ');
    messageSplit1.shift();
    messageSplit1.shift();
    messageSplit1.shift();

    let data1 = data.toString().split('\r\n');
    data1.forEach(async line => {
        line = await stripAnsi(line)
        if(line !== ''){
            //console.log(line)
            line = line.replace('\n', '');
            let messageSplit = line.split(' ');
            messageSplit.shift();
            messageSplit.shift();
            messageSplit.shift();

            console.log(messageSplit.join(' '));

            if(messageSplit.join(' ') === 'Server loaded. Type \'help\' for help.'){
                server.stdin.write('config port '+config.port+'\n');
            }

            if(messageSplit.join(' ').startsWith('Opened a server on port')){
                serverStarted = true;
            }

            //console.log(messageSplit)
            if(logMessage && serverStarted){
                if(messageSplit[0] !== 'Server:' && messageSplit.join(' ') !== ''){
                    logMessage.send(`${messageSplit.join(' ')}`);
                }
            }
        }
    })

    if(data.toString().split(' ')[5] === "connected."){
        players++;

        if(players >= 0 && paused === true){
            logMessage.send('Players online unpausing game');

            server.stdin.write('pause off\n');
            paused = false;
        }
    } else if(data.toString().split(' ')[5] === "disconnected."){
        players--;

        if(players === 0 && paused === false){
            logMessage.send('No players online pausing game');

            server.stdin.write('pause on\n');
            paused = true;
        }
    }
});

server.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});
  
server.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
});

bot.on('ready', () => {
    console.log('Logged In As: '+bot.user.username);

    if(serverOnline) {
        bot.user.setActivity("A Mindustry Server, "+players+" online", { type: "WATCHING" });
    } else{
        bot.user.setActivity(config.prefix+"start | www.phazed.xyz", { type: "LISTENING" });
    }

    setInterval(() => {
        if(serverOnline) {
            bot.user.setActivity("A Mindustry Server, "+players+" online", { type: "WATCHING" });
        } else{
            bot.user.setActivity(config.prefix+"start | www.phazed.xyz", { type: "LISTENING" });
        }
    }, 10000)
});

let icons = {
    copper: '<:copper:908397525772402798>',
    lead: '<:lead:908397525696913458>',
    graphite: '<:graphite:908397525680136203>',
    titanium: '<:titanium:908397525726289920>',
    thorium: '<:thorium:908397525659181067>',
    coal: '<:coal:908397525373964299>',
    'meta glass': '<:metaglass:908397525638197248>',
    plastanium: '<:plastanium:908397525436862465>',
    'phase fabric': '<:phasefabric:908397525667573852>'
};

let getIcons = name => {
    return icons[name] || name;
}

bot.on('messageCreate', async msg => {
    if(msg.author.bot)return;
    if(msg.channel.type === "dm")return;

    if(msg.channel.id === config.linkedChannel && serverStarted){
        server.stdin.write('say ['+msg.author.username+'] '+msg.content+'\n');
    }

    const base64 = msg.content

    if(Buffer.from(base64, 'base64').toString('base64') === base64){
        try{
            const schematic = Schematic.decode(base64)
            
            // save a preview of the schematic
            schematic
                .toImageBuffer()
                .then(buffer => {
                    let discordImage = new discord.MessageAttachment(buffer, 'sch-img.png');

                    const embed = new discord.MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle(`Name: ${schematic.name}`)
                        .setDescription(`Desc: ${schematic.description}`)
                        .addFields([
                            {
                                name: '⚡',
                                value: `${schematic.powerBalance}`
                            }
                        ])
                        .setImage('attachment://sch-img.png');

                    let values = Object.values(schematic.requirements);
                    let keys = Object.keys(schematic.requirements);
                    let i = 0;

                    keys.forEach(k => {
                        console.log(`${getIcons(k)}`, `${values[i]}`)
                        embed.addFields({
                            name: `${getIcons(k)}`,
                            value: `${values[i]}`,
                            inline: true
                        });

                        i++;
                    })

                    msg.channel.send({ embeds: [ embed ], files: [ discordImage ] });
                })
        } catch(e){}
    } else{}

    if(!msg.content.includes(config.prefix))return;
    let args = msg.content.replace(config.prefix, '').split(' ');
    let command = args[0];
    args.shift();

    // if(command === 'spawn' && msg.author.id === '595628769138442250'){
    //     server.stdin.write('js u=UnitTypes.'+args[0]+'.spawn(100,100); u.team=Team.'+args[1]+';\n');

    //     if(args[2] === 'rainbow'){
    //         setInterval(() => {
    //             server.stdin.write('js u.team=Team.sharded\n');
    
    //             setTimeout(() => {
    //                 server.stdin.write('js u.team=Team.derelict\n');
    
    //                 setTimeout(() => {
    //                     server.stdin.write('js u.team=Team.crux\n');
    //                 }, 250)
    //             }, 250)
    //         }, 750)
    //     }
    // }

    if(command === 'bc' || command === 'broadcast' && msg.author.id === '595628769138442250'){
        server.stdin.write('js Call.infoMessage("'+args.join(' ')+'")\n');
    }

    if(command === "start"){
        if(serverOnline){
            msg.channel.send('Server is currently online\n`'+config.ip+'`');
        } else{
            server.stdin.write('host\n');
            currentHost = msg.author;
            serverOnline = true;
            paused = false;
            players = 0;

            msg.channel.send('I put the server online\n`'+config.ip+'`');
            
            logs = [];
            logMessage = msg.channel;
        }
    }

    if(command === "save"){
        if(!args.length)return msg.channel.send('Please specify a slot to save the world in');

        server.stdin.write('save '+msg.author.id+':'+args[0]+'\n');
    }

    if(command === "load"){
        if(!args.length)return msg.channel.send('Please specify a slot to load the world from.');

        if(serverOnline){
            msg.channel.send('Server is already online\n`'+config.ip+'`');
        } else{
            server.stdin.write('load '+msg.author.id+':'+args[0]+'\n');
            currentHost = msg.author;
            serverOnline = true;
            paused = false;
            players = 0;

            msg.channel.send('I put the server online\n`'+config.ip+'`');
            
            logs = [];
            logMessage = msg.channel;
        }
    }

    if(command === "reload"){
        if(currentHost.id === msg.author.id){
            server.stdin.write('js Call.infoMessage("Reloading Server in 5 Seconds")\n');
            msg.channel.send('Reloading Server in 5 Seconds');

            setTimeout(() => {
                server.stdin.write('stop\n');

                logMessage = null;
                serverOnline = false;
                serverStarted = false;

                setTimeout(() => {
                    if(serverOnline){
                        msg.channel.send('Server is currently online\n`'+config.ip+'`');
                    } else{
                        server.stdin.write('host\n');
                        currentHost = msg.author;
                        serverOnline = true;
                        paused = false;
                        players = 0;
            
                        msg.channel.send('I put the server online\n`'+config.ip+'`');
                        
                        logs = [];
                        logMessage = msg.channel;
                    }
                }, 50)
            }, 5000)
        } else{
            msg.channel.send('You are not the current host');
        }
    }

    if(command === "stop"){
        if(currentHost.id === msg.author.id){
            server.stdin.write('stop\n');

            msg.channel.send('Stopped Server');
            logMessage = null;
            serverOnline = false;
            serverStarted = false;
        } else{
            msg.channel.send('You are not the current host');
        }
    }
});

bot.login(config.token);
