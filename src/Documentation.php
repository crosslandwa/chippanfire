<?php

class Documentation {
    private $_filename;

    public function __construct($filename) {
        $this->_filename = $filename;
    }

    public function __toString() {
        return '<form action="' . new Asset('downloads/documentation/' . $this->_filename) . '" method="GET">'
            . '<button type="submit" class="btn btn-success">Download Documentation</button>'
            . '</form>';
    }

}
