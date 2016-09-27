<?php

class Asset {
    private static $_baseUrl = 'https://chippanfire.com/assets/';

    public static function useLocal() {
        self::$_baseUrl = 'assets/';
    }

    public function __construct($filename) {
        $this->_filename = $filename;
    }

    public function __toString() {
        return self::$_baseUrl . $this->_filename;
    }

}
