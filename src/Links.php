<?php

class Links {
    public static $maxForLive;
    public static $abletonLive;
    public static $maxMSP;
    public static $miniak;
    public static $micron;
}

Links::$maxForLive = Link::external('Max For Live', 'http://www.ableton.com/maxforlive');
Links::$abletonLive = Link::external('Ableton Live', 'http://www.ableton.com');
Links::$maxMSP = Link::external('MaxMSP', 'http://www.cycling74.com/');
Links::$miniak = Link::external('Akai Miniak', 'http://www.akaipro.com/product/miniak');
Links::$micron = Link::external('Alesis Micron', 'http://www.vintagesynth.com/misc/micron.php');
