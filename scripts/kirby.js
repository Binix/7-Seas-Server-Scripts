function Kirby(kirbychan) {
	var name = "Kirby Game";
	var game = this;

	var ticks = 0;
	var powers;
	var enemies;
	var enemyTypes;
	var items;
	var events;

	var currentEnemies = [];
	var powerstars = [];
	var powerstarsTimers = [];
	var currentItems = [];
	var currentEvent = 0;
	var eventsEnabled = true;

	var expLevels = [0, 50, 110, 242, 532, 1171, 2576, 5668, 12741, 27437];
	var respawnTime = 40;
	var lostExp = 0.1;
	var simpleEventRate = 0.05;
	var shieldProtection = 0.35;

	var normalBorder = "*** *********************************************************************************************** ***";
	var shortBorder = "*** ************************************** ***";

	this.attackTarget = function(src, commandData) {
		var player = SESSION.users(src);
		var attack = randomElement(powers[player.kirby.power].attacks);
		var damage = Math.floor(attack.power * (1 + (player.kirby.str / 12.5)));
		if (commandData == "*") {
			if (currentEnemies.length > 0) {
				var randomenemy = randomElement(currentEnemies);
				randomenemy.life = randomenemy.life - damage;
				if (!randomenemy.expShare[sys.name(src)]) randomenemy.expShare[sys.name(src)] = 0;
				randomenemy.expShare[sys.name(src)] += damage;
				if (randomenemy.life > 0) {
					sendChannel(attack.message.replace(/~Self~/g, getHtmlName(src)).replace(/~Target~/g, randomenemy.translation).replace(/~Life~/g, randomenemy.life).replace(/~Damage~/g, damage));
				} else {
					var attackType = (player.kirby.power == "none") ? "simple" : cap(player.kirby.power);
					sendChannel(getHtmlName(src) + " defeated " + randomenemy.translation + " with a " + colorString(attackType, powers[player.kirby.power].color) + " attack! ");
					if ("items" in randomenemy && Math.random() < 0.4) {
						var newitem = game.createItem(randomElement(randomenemy.items));
						sendChannel(randomenemy.translation + " dropped a " + newitem.translation + " upon defeat!", "Item");
					}
					game.shareExp(randomenemy);
					currentEnemies.splice(currentEnemies.indexOf(randomenemy), 1);
					delete randomenemy;
				}
			} else {
				sys.sendMessage(src, "±Game: No enemies to attack!", kirbychan);
				return;
			}
		} else {
			if (sys.id(commandData) == undefined) {
				sys.sendMessage(src, "±Game: No such player!", kirbychan);
				return;
			}
			var target = SESSION.users(sys.id(commandData));
			if (!target.kirby.isAlive) {
				sys.sendMessage(src, "±Game: This player is dead!", kirbychan);
				return;
			}
			var attackType = (cap(player.kirby.power) == "None") ? "simple" : cap(player.kirby.power);
			if (Math.random() < target.kirby.evd * 0.0066) {
				sendChannel(getHtmlName(src) + " tried to attack " + getHtmlName(target.id) + " with a " + colorString(attackType, powers[player.kirby.power].color) + " attack, but " + getHtmlName(target.id) + " evaded!");
			} else {
				damage = Math.floor((damage * (1 - (target.kirby.def * 0.015))) * (target.kirby.shield ? shieldProtection : 1));
				if (!target.kirby.expShare[sys.name(src)])
					target.kirby.expShare[sys.name(src)] = 0;
				target.kirby.expShare[sys.name(src)] += damage;
				if (game.damagePlayer(target, damage)) {
					sendChannel(getHtmlName(src) + " killed " + getHtmlName(target.id) + " with a " + colorString(attackType, powers[player.kirby.power].color) + " attack! ", "Death");
					game.shareExpPlayer(target, game.loseExpByDeath(target.id));
				} else {
					sendChannel(attack.message.replace(/~Self~/g, getHtmlName(src)).replace(/~Target~/g, getHtmlName(target.id)).replace(/~Life~/g, target.kirby.life).replace(/~Damage~/g, damage));
					game.losePowerByDamage(target);
				}
			}
		}
		var cooldown = attack.cooldown - (Math.floor(SESSION.users(src).kirby.spd / 7));
		game.setCooldown(src, ((cooldown < 1) ? 1 : cooldown));
	};

	this.swallow = function(src, commandData) {
		var player = SESSION.users(src);
		var cooldown;
		if (player.kirby.power == "none") {
			if (commandData == "*") {
				if (powerstars.length + currentEnemies.length == 0) {
					sys.sendMessage(src, "±Game: You found nothing to swallow!", kirbychan);
					return;
				}
				var swallowables = Math.floor(Math.random() * (powerstars.length + currentEnemies.length));
				if (swallowables < powerstars.length) {
					var randomstar = Math.floor(Math.random() * powerstars.length);
					player.kirby.power = powerstars[randomstar];
					sendChannel(getHtmlName(src) + " swallowed a Power Star and got the " + colorString(cap(player.kirby.power), powers[player.kirby.power].color) + " power!");
					powerstars.splice(randomstar, 1);
					powerstarsTimers.splice(randomstar, 1);
					cooldown = 2;
				} else {
					var randomenemy = randomElement(currentEnemies);
					if (randomenemy.type != "boss" && Math.random() >= randomenemy.life/randomenemy.maxlife) {
						if (!randomenemy.expShare[sys.name(src)]) randomenemy.expShare[sys.name(src)] = 0;
						randomenemy.expShare[sys.name(src)] += 2;
						if (randomenemy.power !== "none") {
							player.kirby.power = randomenemy.power;
							sendChannel(getHtmlName(src) + " swallowed a " + randomenemy.translation + " and got the " + colorString(cap(player.kirby.power), powers[player.kirby.power].color) + " power!");
						} else {
							sendChannel(getHtmlName(src) + " swallowed a " + randomenemy.translation + ", but didn't get any power!");
						}
						game.shareExp(randomenemy);
						currentEnemies.splice(currentEnemies.indexOf(randomenemy), 1);
						delete randomenemy;
						cooldown = 4;
					} else {
						sendPlayer(src, "You failed in swallowing a " + randomenemy.translation + ". ");
					}
				}
			} else {
				if (sys.id(commandData) == undefined) {
					sys.sendMessage(src, "±Game: No such player!", kirbychan);
					return;
				}
				var target = SESSION.users(sys.id(commandData));
				if (sys.name(src).toLowerCase() == target.name.toLowerCase()) {
					sys.sendMessage(src, "±Game: You can't swallow yourself!", kirbychan);
					return;
				}
				if (!target.kirby.isAlive) {
					sys.sendMessage(src, "±Game: This player is dead!", kirbychan);
					return;
				}
				if (Math.random() < 0.40) {
					if (target.kirby.power !== "none") {
						sendChannel(getHtmlName(src) + " swallowed " + getHtmlName(target.id) + " and stole his/her " + colorString(cap(target.kirby.power), powers[target.kirby.power].color) + " power (and " + getHtmlName(target.id) + " lost 2 life points)! ");
						player.kirby.power = target.kirby.power;
						target.kirby.power = "none";
					} else {
						sendChannel(getHtmlName(src) + " swallowed " + getHtmlName(target.id) + ", but didn't get any power (but " + getHtmlName(target.id) + " lost 2 life points)! ");
					}
					if (!target.kirby.expShare[sys.name(src)]) target.kirby.expShare[sys.name(src)] = 0;
					target.kirby.expShare[sys.name(src)] += 2;
					if (game.damagePlayer(target, 2)) {
						sendChannel(getHtmlName(src) + "killed " + getHtmlName(target.id) + " by swallowing him/her!", "Death");
						game.shareExpPlayer(target, game.loseExpByDeath(target.id));
					}
					cooldown = 6;
				} else {
					sendPlayer(src, "You failed to swallow " +  getHtmlName(target.id) + "!");
					return;
				}
			}
			cooldown = cooldown - (Math.floor(player.kirby.spd / 7));
			game.setCooldown(src, ((cooldown < 1) ? 1 : cooldown));
		} else {
			sys.sendMessage(src, "±Game: You already have a power!", kirbychan);
		}
	};

	this.releasePower = function(src, commandData) {
		var player = SESSION.users(src);
		if (player.kirby.power !== "none") {
			sendPlayer(src, "You released your " + colorString(cap(player.kirby.power), powers[player.kirby.power].color) + " power!");
			sendChannel(" A " + colorString(cap(player.kirby.power), powers[player.kirby.power].color) + " power star is bouncing around!", "Power");
			powerstars.push(player.kirby.power);
			powerstarsTimers.push(ticks + 40);
			player.kirby.power = "none";
		} else {
			sys.sendMessage(src, "±Game: You don't have any power!", kirbychan);
		}
	};

	this.protectSelf = function(src) {
		SESSION.users(src).kirby.shield = true;
		game.setCooldown(src, 15);
		sendChannel(getHtmlName(src) + " is now shielding itself!");
		sys.delayedCall( function() {
			if (sys.isInChannel(src, kirbychan)) {
				SESSION.users(src).kirby.shield = false;
				sendPlayer(src, "Your shield is now off!", "Shield");
			}
		}, 10);
	};

	this.getItem = function(src) {
		if (currentItems.length == 0) {
			sendPlayer(src, "No items found!", "Game");
			return;
		}
		var randomitem = Math.floor(Math.random() * currentItems.length);
		game.damagePlayer(SESSION.users(src), -(currentItems[randomitem].restore));
		sendChannel(currentItems[randomitem].message.replace(/~Self~/g, getHtmlName(src)));
		currentItems.splice(randomitem, 1);
	};

	this.reviveSelf = function(src) {
		if (!SESSION.users(src).kirby.isAlive) {
			if (!game.checkCooldown(src)) return
			game.setCooldown(src, 0);
			SESSION.users(src).kirby.isAlive = true;
			SESSION.users(src).kirby.power = "none";
			SESSION.users(src).kirby.expShare = {};
			SESSION.users(src).kirby.life = SESSION.users(src).kirby.maxlife;
			sendChannel("Player " + getHtmlName(src) + " was revived!");
		}
	};

	this.monstersAttack = function() {
		var players = sys.playersOfChannel(kirbychan);
		if (players.length == 0) return;
		for(var m in currentEnemies) {
			var monster = currentEnemies[m];
			if (monster.cooldown <= ticks && Math.random() < 0.15) {
				var target = SESSION.users(randomElement(players));
				if (!target.kirby.isAlive) continue;
				var attack = randomElement(monster.attacks);
				if (Math.random() < target.kirby.evd * 0.0066) {
					sendChannel(monster.translation + " tried to attack " + getHtmlName(target.id) + ", but " + getHtmlName(target.id) + " evaded!");
				} else {
					var damage = Math.floor((attack.power * (1 - (target.kirby.def * 0.015))) * (target.kirby.shield ? shieldProtection : 1) );
					if (game.damagePlayer(target, damage)) {
						sendChannel(getHtmlName(target.id) + " took " + damage + " of damage and was defeated by a " + monster.translation + "!", "Death");
						game.loseExpByDeath(target.id);
					} else {
						sendChannel(attack.message.replace(/~Self~/g, monster.translation).replace(/~Target~/g, getHtmlName(target.id)).replace(/~Life~/g, target.kirby.life).replace(/~Damage~/g, damage));
						game.losePowerByDamage(target);
					}
				}
				monster.cooldown = ticks + attack.cooldown;
			}
		}
	};

	this.setCooldown = function(src, time) {
		SESSION.users(src).kirby.cooldown = ticks + time;
	};

	this.checkCooldown = function(src) {
		if (SESSION.users(src).kirby.cooldown > ticks) {
			sys.sendMessage(src, "±Game: You need to wait " + (SESSION.users(src).kirby.cooldown - ticks) + " seconds to act again!", kirbychan);
			return false;
		}
		return true;
	};

	this.damagePlayer = function(target, damage) {
		target.kirby.life = target.kirby.life - damage;
		if (target.kirby.life <= 0) {
			game.kill(target.name);
			return true;
		}
		if (target.kirby.life > target.kirby.maxlife) {
			target.kirby.life = target.kirby.maxlife;
		}
		return false;
	};

	this.losePowerByDamage = function(target) {
		if (target.kirby.power !== "none" && Math.random() < 0.15) {
			sys.sendHtmlMessage(target.id, "<font color='red'><timestamp/> You lost your <b>" + colorString(cap(target.kirby.power), powers[target.kirby.power].color) + "</b> power due to the damage!</font>", kirbychan);
			sendChannel(" A " + colorString(cap(target.kirby.power), powers[target.kirby.power].color) + " power star is bouncing around!", "Power");
			powerstars.push(target.kirby.power);
			powerstarsTimers.push(ticks + 50);
			target.kirby.power = "none";
		}
	};

	this.kill = function(commandData) {
		SESSION.users(sys.id(commandData)).kirby.life = 0;
		SESSION.users(sys.id(commandData)).kirby.isAlive = false;
		game.setCooldown(sys.id(commandData), respawnTime);
	};

	this.loseExpByDeath = function(src) {
		var target = SESSION.users(src);
		var exp = Math.floor(target.kirby.exp * lostExp);
		sendPlayer(src, "You lost " + exp + " Exp. Points!", "Exp");
		game.getExp(src, -exp);
		return exp;
	};

	this.shareExpPlayer = function(target, amount) {
		var players = Object.keys(target.kirby.expShare);
		for (var p in target.kirby.expShare) {
			if (sys.id(p) == undefined || sys.id(p) == target.id) continue;
			var expGained = Math.floor((target.kirby.expShare[p] / target.kirby.maxlife) * amount);
			sendPlayer(sys.id(p), "You received " + expGained + " Exp. Points!", "Exp");
			game.getExp(sys.id(p), expGained);
		}
	};

	this.shareExp = function(monster) {
		var players = Object.keys(monster.expShare);
		for (var p in monster.expShare) {
			if (sys.id(p) == undefined) continue;
			var expGained = Math.floor((monster.expShare[p] / monster.maxlife) * monster.exp);
			sendPlayer(sys.id(p), "You received " + expGained + " Exp. Points!", "Exp");
			game.getExp(sys.id(p), expGained);
		}
	};

	this.getExp = function(src, amount) {
		var player = SESSION.users(src);
		player.kirby.exp = player.kirby.exp - (-amount);
		if (player.kirby.exp < 0)
			player.kirby.exp = 0;
		var e;
		for (e = expLevels.length - 1; e >= 0; --e) {
			if (player.kirby.exp >=  expLevels[e]) {
				e = e + 1;
				break;
			}
		}
		// If a level change is detected, run this leveling method
		if (player.kirby.level != e) {
			var diff = (e - player.kirby.level > 0) ? 1 : -1;
			var currentStats = {
				"str": player.kirby.str,
				"def": player.kirby.def,
				"spd": player.kirby.spd,
				"evd": player.kirby.evd,
				"maxlife": player.kirby.maxlife
			};

			var ev = powers[player.kirby.power].ev;
			while (player.kirby.level !== e) {
				player.kirby.str += diff * ((Math.floor(Math.random() * 2.2) + 1) + Math.floor(ev.str * player.kirby.level * 0.22));
				player.kirby.def += diff * ((Math.floor(Math.random() * 2.2) + 1) + Math.floor(ev.def * player.kirby.level * 0.22));
				player.kirby.spd += diff * ((Math.floor(Math.random() * 2.2) + 1)  + Math.floor(ev.spd * player.kirby.level * 0.22));
				player.kirby.evd += diff * ((Math.floor(Math.random() * 2.2) + 1)  + Math.floor(ev.evd * player.kirby.level * 0.22));
				player.kirby.maxlife += diff * ((Math.floor(Math.random() * 12) + 6) + Math.floor(ev.life * player.kirby.level * 1.15));
				player.kirby.level += diff;
			}
			if (player.kirby.maxlife < 80) player.kirby.maxlife = 80;
			if (player.kirby.str < 1) player.kirby.str = 1;
			if (player.kirby.def < 1) player.kirby.def = 1;
			if (player.kirby.spd < 1) player.kirby.spd = 1;
			if (player.kirby.evd < 1) player.kirby.evd = 1;

			player.kirby.life = player.kirby.maxlife;
			sys.sendMessage(src, shortBorder, kirbychan);
			sendChannel(getHtmlName(src) + "'s level is now " + player.kirby.level + "!", "Level");
			if (diff > 0) {
				sys.sendMessage(src, "±Stats: Your Maximum Life increased by " + (player.kirby.maxlife - currentStats.maxlife) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Strength increased by " + (player.kirby.str - currentStats.str) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Defense increased by " + (player.kirby.def - currentStats.def) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Speed increased by " + (player.kirby.spd - currentStats.spd) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Evasion increased by " + (player.kirby.evd - currentStats.evd) + "!", kirbychan);
			} else {
				sys.sendMessage(src, "±Stats: Your Maximum Life decreased by " + (currentStats.maxlife - player.kirby.maxlife) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Strength decreased by " + (currentStats.str - player.kirby.str) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Defense decreased by " + (currentStats.def - player.kirby.def) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Speed decreased by " + (currentStats.spd - player.kirby.spd) + "!", kirbychan);
				sys.sendMessage(src, "±Stats: Your Evasion decreased by " + (currentStats.evd - player.kirby.evd) + "!", kirbychan);
			}
			sys.sendMessage(src, shortBorder, kirbychan);
		}
	};

	this.createEnemy = function(commandData) {
		var newenemy = new Enemy(enemies[commandData]);
		currentEnemies.push(newenemy);
		return newenemy;
	};

	function Enemy(data) {
		for(var a in data) {
			this[a] = data[a];
		}
		this.maxlife = this.life;
		this.cooldown = 0;
		this.expShare = {};
	}

	this.addEnemy = function(src, commandData) {
		if (!(commandData.toLowerCase() in enemies)) {
			sys.sendMessage(src, "±Game: No such enemy!", kirbychan);
			return false;
		}
		var newenemy = game.createEnemy(commandData.toLowerCase());
		sendChannel("A wild "+ newenemy.translation + " has appeared!", "Enemy");
	};

	this.addEnemyGroup = function(src, commandData) {
		var info = commandData.split(":");
		var enemyName = info[0].toLowerCase();
		var quantity = info[1] || 2;
		if (!(quantity > 0)) {
			sys.sendMessage(src, "±Game: This is not a valid number!", kirbychan);
			return false;
		}
		if (!(enemyName in enemies)) {
			sys.sendMessage(src, "±Game: No such enemy!", kirbychan);
			return false;
		}
		var newenemy;
		for (var i = 0; i < quantity; ++i) {
			newenemy = game.createEnemy(enemyName);
		}
		sendChannel("A group of " + quantity + " " + newenemy.translation + " has appeared!", "Enemy");
	};

	this.createItem = function(commandData) {
		var data = items[commandData.toLowerCase()]
		var newitem = {
			"translation": data.translation,
			"restore": data.restore,
			"message": data.message,
			"duration": ticks + data.duration
		};
		currentItems.push(newitem);
		return newitem;
	};

	this.addItem = function(src, commandData) {
		var info = commandData.split(":");
		var itemName = info[0].toLowerCase();
		var quantity = info[1] || 1;
		if (!(quantity > 0)) {
			sys.sendMessage(src, "±Game: This is not a valid number!", kirbychan);
			return false;
		}
		if (!(itemName in items)) {
			sys.sendMessage(src, "±Game: No such item!", kirbychan);
			return false;
		}
		var newitem;
		for (var i = 0; i < quantity; ++i) {
			newitem = game.createItem(itemName);
		}
		sendChannel(sys.name(src) + " threw " + quantity + " " + newitem.translation + "(s) on the stage!", "Item");
	};

	this.createEvent = function(commandData) {
		var newevent = events[commandData];
		var t, q;
		if ("enemies" in newevent) {
			for (t in newevent.enemies) {
				for (q = newevent.enemies[t]; q > 0; --q) {
					var newenemy = game.createEnemy(t);
					if ("bonusexp" in newevent) {
						newenemy.exp = Math.floor(newenemy.exp * newevent.bonusexp);
					}
				}
			}
		}
		if ("items" in newevent) {
			for (t in newevent.items) {
				for (q = newevent.items[t]; q > 0; --q) {
					game.createItem(t);
				}
			}
		}
		if ("powers" in newevent) {
			for (t in newevent.powers) {
				for (q = newevent.powers[t]; q > 0; --q) {
					powerstars.push(t);
					powerstarsTimers.push((newevent.duration / 2) + ticks);
				}
			}
		}
		sys.sendAll(normalBorder, kirbychan);
		sendChannel(newevent.announcement, "Event");
		sys.sendAll(normalBorder, kirbychan);
		currentEvent = ticks + newevent.duration;
	};

	this.startEvent = function(src, commandData) {
		if (!(commandData.toLowerCase() in events)) {
			sys.sendMessage(src, "±Game: No such event!", kirbychan);
			return;
		}
		game.createEvent(commandData.toLowerCase());
	};

	this.randomSimpleEvent = function() {
		var rndValue = Math.random();
		if (rndValue < 0.75) {
			var monsterList;
			if (rndValue < 0.01) {
				monsterList = enemyTypes["miniboss"];
			} else if (rndValue < 0.04) {
				monsterList = enemyTypes["rare"];
			} else {
				monsterList = enemyTypes["common"];
			}
			var newenemy = game.createEnemy(randomElement(monsterList));
			sendChannel("A wild "+ newenemy.translation + " has appeared!", "Enemy");
		} else {
			var possibleItems = Object.keys(items);
			var newitem = game.createItem(randomElement(possibleItems));
			sendChannel("A "+ newitem.translation + " suddenly appeared!", "Item");
		}
	};

	this.revivePlayer = function(src, commandData) {
		if (sys.id(commandData) != undefined) {
			game.resetPlayer(sys.id(commandData));
			sendChannel("Player " + getHtmlName(sys.id(commandData)) + " was reset!");
		} else {
			sys.sendMessage(src, "±Game: No such player!", kirbychan);
		}
	};

	this.slayUser = function(src, commandData) {
		if (sys.id(commandData) != undefined) {
			game.kill(commandData);
			sendChannel("Player " + getHtmlName(sys.id(commandData)) + " was slayed by " + sys.name(src) + "!", "Game");
		} else {
			sys.sendMessage(src, "±Game: No such player!", kirbychan);
		}
	};

	this.changePlayerPower = function(src, commandData) {
		var data = commandData.split(":");
		if (sys.id(data[0]) !== undefined) {
			if (!SESSION.users(sys.id(data[0])).kirby.isAlive) {
				sys.sendMessage(src, "±Game: This player is dead!", kirbychan);
				return;
			}
			var newpower = (data[1]) ? data[1].toLowerCase() : "none";
			if (newpower in powers && newpower !== "none") {
				sendChannel("Player " + getHtmlName(sys.id(data[0])) + " was blessed by " + sys.name(src) + " and received the " + colorString(cap(newpower), powers[newpower].color) + " power!", "Game");
				SESSION.users(sys.id(data[0])).kirby.power = newpower;
			} else {
				sendChannel("Player " + getHtmlName(sys.id(data[0])) + " had his/her power mysteriously removed by " + sys.name(src) + "!", "Game");
			}
		} else {
			sys.sendMessage(src, "±Game: No such player!", kirbychan);
		}
	};

	this.healPlayer = function(src, commandData) {
		var data = commandData.split(":");
		if (sys.id(data[0]) != undefined) {
			if (!SESSION.users(sys.id(data[0])).kirby.isAlive) {
				sys.sendMessage(src, "±Game: This player is dead!", kirbychan);
				return;
			}
			var target = sys.id(data[0]);
			var extralife = data[1];
			if (extralife === undefined || extralife == 0 ) {
				sys.sendMessage(src, "±Game: Specify an amount of life points!", kirbychan);
			} else {
				if (extralife > 0) {
					sendChannel("Player " + getHtmlName(target) + " was healed by " + sys.name(src) + " gained " + extralife + " life points!");
				} else {
					sendChannel("Player " + getHtmlName(target) + " was punished by " + sys.name(src) + " lost " + (-extralife) + " life points!");
				}
				if (game.damagePlayer(SESSION.users(target), -extralife)) {
					sendChannel(getHtmlName(target) + " died from the punishment!", "Death");
				}
			}
		} else {
			sys.sendMessage(src, "±Game: No such player!", kirbychan);
		}
	};

	this.addExp = function(src, commandData) {
		var data = commandData.split(":");
		if (sys.id(data[0]) != undefined) {
			if (!SESSION.users(sys.id(data[0])).kirby.isAlive) {
				sys.sendMessage(src, "±Game: This player is dead!", kirbychan);
				return;
			}
			var exp = data[1];
			if (exp === undefined || exp == 0 ) {
				sys.sendMessage(src, "±Game: Specify an amount of exp. points!", kirbychan);
			} else {
				if (exp > 0) {
					sendChannel(sys.name(src) + " gave " + exp + " Exp. Points to " + getHtmlName(sys.id(data[0])) + "!", "Game");
				} else {
					sendChannel(sys.name(src) + " removed " + (-exp) + " Exp. Points from " + getHtmlName(sys.id(data[0])) + "!", "Game");
				}
				game.getExp(sys.id(data[0]), exp);
			}
		} else {
			sys.sendMessage(src, "±Game: No such player!", kirbychan);
		}
	};

	this.viewStats = function(src) {
		var player = SESSION.users(src).kirby;
		sys.sendHtmlMessage(src, " ", kirbychan);
		sys.sendHtmlMessage(src, getHtmlName(src) + "'s stats: ", kirbychan);
		sys.sendHtmlMessage(src, "<b>Level:</b> " + player.level + " (" + player.exp + " Exp. Points / " + (player.level == expLevels.length ? "Maximum Level)" : (expLevels[player.level] - player.exp) + " points to next level)"), kirbychan);
		sys.sendHtmlMessage(src, "<b>Power:</b> " + colorString(cap(player.power), powers[player.power].color), kirbychan);
		sys.sendHtmlMessage(src, "<b>Life:</b> " + player.life + "/" + player.maxlife, kirbychan);
		sys.sendHtmlMessage(src, "<b>Str:</b> " + player.str, kirbychan);
		sys.sendHtmlMessage(src, "<b>Def:</b> " + player.def, kirbychan);
		sys.sendHtmlMessage(src, "<b>Spd:</b> " + player.spd, kirbychan);
		sys.sendHtmlMessage(src, "<b>Evd:</b> " + player.evd, kirbychan);
		sys.sendHtmlMessage(src, " ", kirbychan);
	};

	this.viewPlayers = function(src) {
		var players = sys.playersOfChannel(kirbychan);
		var alive = [];
		var dead = [];
		for (var p in players) {
			var player = SESSION.users(players[p]);
			if (player.kirby.isAlive) {
				alive.push(getHtmlName(players[p]) + " (Life: " + player.kirby.life + ", Power: " + colorString(cap(player.kirby.power), powers[player.kirby.power].color) + ", Lv. " + player.kirby.level + ")");
			} else {
				dead.push(getHtmlName(players[p]) + " (Lv. " + player.kirby.level + ")");
			}
		}
		if (alive.length == 0) alive.push("None");
		if (dead.length == 0) dead.push("None");

		sys.sendHtmlMessage(src, " ", kirbychan);
		sys.sendHtmlMessage(src, "<b>Alive Players (" + (alive[0] == "None" ? 0 : alive.length) + ")</b>", kirbychan);
		sys.sendHtmlMessage(src, alive.join(", "), kirbychan);
		sys.sendHtmlMessage(src, " ", kirbychan);
		sys.sendHtmlMessage(src, "<b>Dead Players (" + (dead[0] == "None" ? 0 : dead.length) + ")</b>", kirbychan);
		sys.sendHtmlMessage(src, dead.join(", "), kirbychan);
		sys.sendHtmlMessage(src, "  ", kirbychan);
	};

	this.viewEnemies = function(src) {
		if (currentEnemies.length == 0) {
			sys.sendMessage(src, "±Game: No enemies!", kirbychan);
			return;
		}
		var enemylist = [];
		for (var i = 0; i < currentEnemies.length; ++i) {
			enemylist.push(currentEnemies[i].translation + " (" + currentEnemies[i].life + ")");
		}
		sys.sendHtmlMessage(src, " ", kirbychan);
		sys.sendHtmlMessage(src, "<b>Current enemies (" + currentEnemies.length + ") </b>", kirbychan);
		sys.sendHtmlMessage(src, enemylist.join(", "), kirbychan);
		sys.sendHtmlMessage(src, " ", kirbychan);
	};

	this.viewItems = function(src) {
		var items = [];
		var stars = [];

		for (var p in currentItems) {
			items.push(currentItems[p].translation);
		}
		for (p in powerstars) {
			stars.push(cap(powerstars[p]));
		}
		if (items.length == 0) items.push("None");
		if (stars.length == 0) stars.push("None");

		sys.sendHtmlMessage(src, " ", kirbychan);
		sys.sendHtmlMessage(src, "<b>Items (" + (items[0] == "None" ? 0 : items.length) + ")</b>", kirbychan);
		sys.sendHtmlMessage(src, items.join(", "), kirbychan);
		sys.sendHtmlMessage(src, "<b>Power Stars (" + (stars[0] == "None" ? 0 : stars.length) + ")</b>", kirbychan);
		sys.sendHtmlMessage(src, stars.join(", "), kirbychan);
		sys.sendHtmlMessage(src, "  ", kirbychan);
	};

	this.showCommands = function(src, commandData) {
        sys.sendMessage(src, "", kirbychan);
		if (commandData.toLowerCase() !== "auth"){
			sys.sendMessage(src, "Actions:", kirbychan);
			for (var x in this.commands.actions) {
				sys.sendMessage(src, "/" + x + " - " + this.commands.actions[x][1], kirbychan);
			}
			sys.sendMessage(src, "Channel commands:", kirbychan);
			for (x in this.commands.channel) {
				sys.sendMessage(src, "/" + x + " - " + this.commands.channel[x][1], kirbychan);
			}
		} else {
			if (isKirbyAdmin(src)) {
				sys.sendMessage(src, "Operator Commands:", kirbychan);
				for (x in this.commands.op) {
					sys.sendMessage(src, "/" + x + " - " + this.commands.op[x][1], kirbychan);
				}
			}
			if (SESSION.channels(kirbychan).masters.indexOf(sys.name(src).toLowerCase()) != -1) {
				sys.sendMessage(src, "Owner Commands:", kirbychan);
				for (x in this.commands.master) {
					sys.sendMessage(src, "/" + x + " - " + this.commands.master[x][1], kirbychan);
				}
			}
		}
        sys.sendMessage(src, "", kirbychan);
    };

	this.showHelp = function(src) {
		var help = [
			"",
			"*** *********************************************************************** ***",
			"±Game: Everyone is a Kirby and must battle against monsters and other players to get to the level " + expLevels.length + ". ",
			"*** *********************************************************************** ***",
			"±Actions: Use /commands to see the actions you can perform. ",
			"±Powers: Each ability has different attacks, with different powers and cooldown for using it.",
			"*** *********************************************************************** ***",
			"±Exp: You get experience points when an enemy or player you attacked is defeated.",
			"±Level: When you gather enough exp. points, you level up and your stats are increased.",
			"±Stats: Str raises the damage you cause, Def reduces the damage you receive. ",
			"±Stats: Spd lowers the cooldown after an attack, Evd increases your chances of evading an attack. ",
			"±Stats: The points you will get for each stat when leveling up depends on your current power.",
			"±Death: You can also lose exp. points, levels and stats when you are defeated. ",
			"*** *********************************************************************** ***",
			"±Events: Eventually, random enemies will appear and attack the players. Defeat them before they defeat you. ",
			"±Events: Some healing items could also appear. Get them with /get.",
			"±Events: Some rare events can also happen, bringing lots of enemies (including bosses), items and power stars.",
			"±Events: Enemies brought by those rare events give extra exp. points.",
			"*** *********************************************************************** ***",
			"±Rules: Server rules apply in this channel too.",
			"±Rules: Refrain from spamming, even if you can attack really fast.",
			"±Rules: Do not target the same player all the time or pick on weaker players.",
			"*** *********************************************************************** ***",
			""
		];
		for (var x in help) {
           sys.sendMessage(src, help[x], kirbychan);
        }
	};

	this.toogleEvents = function(src) {
		eventsEnabled = !eventsEnabled;
		sendChannel("Events are now " + (eventsEnabled == true ? "enabled" : "disabled") + "!", "Game");
	};

	this.setSimpleEventRate = function(src, commandData) {
		if (commandData < 0 || commandData > 100) {
			sys.sendMessage(src, "±Game: This is not a valid value!", kirbychan);
			return;
		}
		simpleEventRate = commandData/100;
		sys.sendMessage(src, "±Game: Random Simple Events will now happen at a rate of " + simpleEventRate + "!", kirbychan);
	};

	this.resetPlayer = function(src) {
		SESSION.users(src).kirby = {
			"power": "none",
			"level": 1,
			"exp": 0,
			"life": 100,
			"maxlife": 100,
			"str": 3,
			"def": 3,
			"spd": 3,
			"evd": 3,
			"shield": false,
			"isAlive": true,
			"expShare": {}
		};
		game.setCooldown(src, 0);
	};

	this.resetAll = function() {
		var players = sys.playersOfChannel(kirbychan);
		for (var p in players) {
			game.resetPlayer(players[p]);
		}
		currentEnemies = [];
		powerstars = [];
		powerstarsTimers = [];
		// ticks = 0;
		// currentEvent = 0;
		sendChannel("<font color='red'>The Kirby game was reset!</font>");
	};

	this.resetAllTimers = function() {
		var players = sys.playersOfChannel(kirbychan);
		for (var p in players) {
			game.setCooldown(players[p], 0);
		}
		// ticks = 0;
		// currentEvent = 0;
	};

	this.clearMonsters = function(src) {
		currentEnemies = [];
		sendChannel(sys.name(src) + " eliminated all the monsters!", "Game");
	};
	
	this.clearItems = function(src) {
		powerstars = [];
		powerstarsTimers = [];
		currentItems = [];
		sendChannel(sys.name(src) + " removed all the items!", "Game");
	};

	this.runUpdate = function(src) {
        var POglobal = SESSION.global();
        var index, source;
        for (var i = 0; i < POglobal.plugins.length; ++i) {
            if ("kirby.js" == POglobal.plugins[i].source) {
                source = POglobal.plugins[i].source;
                index = i;
            }
        }
        if (index !== undefined) {
            updateModule(source, function(module) {
                POglobal.plugins[i] = module;
                module.source = source;
                module.init();
                sys.sendAll("Update complete!", kirbychan);
            });
            sys.sendAll("Updating kirby game...", kirbychan);
        }
        return;
    };

	this.loadInfo = function() {
		try {
			var content = sys.getFileContent("kirbyinfo.json");
			var parsed = JSON.parse(content);
			powers = parsed.powers;
			enemies = parsed.enemies;
			items = parsed.items;
			events = parsed.events;
			enemyTypes = {};
			for (var e in enemies) {
				var type = enemies[e].type;
				if (!(type in enemyTypes)) enemyTypes[type] = [];
				enemyTypes[type].push(e);
			}
		} catch (err) {
			sys.sendAll("Error loading Kirby Game data: " + err, kirbychan);
		}
		game.resetAllTimers();
	};

	this.commands = {
		actions: {
			attack: [this.attackTarget, "Use your current power. /attack will hit a random enemy and /attack [name] will hit that player. "],
			swallow: [this.swallow, "Only usable if you have no power. Inhale a power star or enemy to get its power. If /swallow [name] is used, you will inhale another player. "],
			release: [this.releasePower, "Release your current power."],
			shield: [this.protectSelf, "To protect yourself for 10 seconds. Damage you receive will be reduced to " + (shieldProtection * 100) + "%." ],
			get: [this.getItem, "To collect a item."],
			revive: [this.reviveSelf, "To revive " + respawnTime + " seconds after you died."]
		},
		channel: {
			commands: [this.showCommands, "To view this list."],
			help: [this.showHelp, "To view a help description about this channel."],
			stats: [this.viewStats, "To view your stats."],
			players: [this.viewPlayers, "To view players in the Kirby Game."],
			enemies: [this.viewEnemies, "To view the alive enemies."],
			items: [this.viewItems, "To view the items and powerstars currently on stage."]
		},
		op: {
			add: [this.addEnemy, "Add a enemy to the Kirby Game"],
			mob: [this.addEnemyGroup, "Add various enemies to the Kirby Game"],
			item: [this.addItem, "To add a item to the stage."],
			slay: [this.slayUser, "To slay a player."],
			bless: [this.changePlayerPower, "To change the power of a player."],
			heal: [this.healPlayer, "To change the life points of a player."],
			exp: [this.addExp, "To modify a player's experience points."],
			clear: [this.clearMonsters, "To eliminate all the monsters."],
			clearitems: [this.clearItems, "To eliminate all the items."],
			startevent: [this.startEvent, "To start a new event."],
			eventrate: [this.setSimpleEventRate, "To set the rate at which random simple events will occur (0 ~ 100)."],
			toogleevents: [this.toogleEvents, "To enable or disable events"],
			reset: [this.revivePlayer, "To reset a player."]
		},
		master: {
			reboot: [this.resetAll, "To reset all players"],
			updateafter: [this.runUpdate, "Update the Kirby Channel."]
		}
	};

	this.handleCommand = function(src, message, channel) {
        if (channel != kirbychan)
            return;
        try {
			game.handleCommandOld(src, message, channel);
            return true;
        } catch(e) {
            if (e != "No valid command") {
                sys.sendAll("Error on kirby command: " + e, kirbychan);
                return true;
            }
        }
    };

	this.handleCommandOld = function(src, message, channel) {
		var command;
		var commandData = '*';
		var pos = message.indexOf(' ');
		if (pos != -1) {
			command = message.substring(0, pos).toLowerCase();
			commandData = message.substr(pos+1);
		} else {
			command = message.substr(0).toLowerCase();
		}
		if (command in this.commands.channel) {
			this.commands.channel[command][0].call(this, src, commandData);
			return true;
		}

		if (command in this.commands.actions) {
			if (!SESSION.users(src).kirby.isAlive && command !== "revive") {
				sys.sendMessage(src, "±Game: You are dead!", kirbychan);
				return true;
			}
			if (!game.checkCooldown(src)) return true;

			game.setCooldown(src, 0);
			this.commands.actions[command][0].call(this, src, commandData);
			return true;
		}

		if (!isKirbyAdmin(src)) {
			throw ("No valid command");
		}

		if (command in this.commands.op) {
			this.commands.op[command][0].call(this, src, commandData);
			return true;
		}

		if (SESSION.channels(kirbychan).masters.indexOf(sys.name(src).toLowerCase()) == -1) {
			throw ("No valid command");
		}

		if (command in this.commands.master) {
			this.commands.master[command][0].call(this, src, commandData);
			return true;
		}

		throw ("No valid command");
	};

	this.tickDown = function() {
		ticks++;
		var removedStars = [];
		for (var s = powerstarsTimers.length - 1; s >= 0; --s) {
			if (powerstarsTimers[s] <= ticks) {
				removedStars.push(colorString(cap(powerstars[s]), powers[powerstars[s]].color));
				powerstarsTimers.splice(s, 1);
				powerstars.splice(s, 1);
			}
		}
		if (removedStars.length > 0) {
			sendChannel("The following power stars disappeared: " + removedStars.join(", "), "Power");
		}
		
		var removedItems = [];
		for (s = currentItems.length -1; s>= 0; --s) {
			if (currentItems[s].duration <= ticks) {
				removedItems.push(currentItems[s].translation);
				currentItems.splice(s, 1);
			}
		}
		if (removedItems.length > 0) {
			sendChannel("The following items disappeared: " + removedItems.join(", "), "Item");
		}
		
		game.monstersAttack();
		if (eventsEnabled && ticks > currentEvent && playersAlive() == true) {
			var chance = Math.random();
			if(chance < 0.007) {
				game.createEvent(randomElement(Object.keys(events)));
			} else if (chance < simpleEventRate) {
				game.randomSimpleEvent();
			}
		}
	};
	
	this.init = function() {
		var name="Kirby Game";
		if (sys.existChannel(name)) {
            kirbychan = sys.channelId(name);
        } else {
            kirbychan = sys.createChannel(name);
        }
        SESSION.global().channelManager.restoreSettings(kirbychan);
        SESSION.channels(kirbychan).perm = true;
        SESSION.channels(kirbychan).master = "RiceKirby";
		game.loadInfo();
	};

	this.beforeChannelJoin = function(src, channel) {
        if (channel != kirbychan) return false;
        if (SESSION.users(src).kirby == undefined) {
			game.resetPlayer(src);
		}
        return false;
    };

	this.beforeChatMessage = function(src, message, chan) {

	};

	this.stepEvent = function() {
        try {
            game.tickDown();
        } catch(err) {
            sys.sendAll("±KirbyBot: error occurred: " + err, kirbychan);
        }
    };
	
	function playersAlive() {
		var players = sys.playersOfChannel(kirbychan);
		for (var p in players) {
			if (SESSION.users(players[p]).kirby.isAlive == true) {
				return true;
			}
		}
		return false;
	}

	function isKirbyAdmin(src) {
		if (sys.auth(src) >= 1)
            return true;
        if (SESSION.channels(kirbychan).operators.indexOf(sys.name(src).toLowerCase()) != -1 || SESSION.channels(kirbychan).masters.indexOf(sys.name(src).toLowerCase()) != -1) {
            return true;
        }
        return false;
	}

	function sendChannel(message, bot) {
		var botname = (bot == undefined) ? "<timestamp/> " : "<font color='#3daa68'><timestamp/> <b>±" + bot + ":</b></font> ";
		sys.sendHtmlAll(botname + message, kirbychan);
	}

	function sendPlayer(src, message, bot) {
		var botname = (bot == undefined) ? "Game" : bot;
		sys.sendHtmlMessage(src, "<font color='#3daa68'><timestamp/> <b>±" + botname + ":</b></font> " + message, kirbychan);
	}

	function randomElement(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	function cap(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

	function colorString(message, color) {
		return "<font color='" + color + "'>" + message + "</font>";
	}

	function getHtmlName(src) {
		return "<b>" + colorString(sys.name(src), sys.getColor(src)) + "</b>";
	}
}

module.exports = function() {
	var init = function() {
		var id;
		var name = "Kirby Game";
		if (sys.existChannel(name)) {
			id = sys.channelId(name);
		} else {
			id = sys.createChannel(name);
		}
		SESSION.global().channelManager.restoreSettings(id);
		SESSION.channels(id).perm = true;
		SESSION.channels(id).master = "RiceKirby";
	}

	var game = new Kirby(sys.channelId("Kirby Game"));

	return {
		game: game,
		init: game.init,
		beforeChatMessage: game.beforeChatMessage,
		handleCommand: game.handleCommand,
        beforeChannelJoin: game.beforeChannelJoin,
		stepEvent: game.stepEvent
	};
}();